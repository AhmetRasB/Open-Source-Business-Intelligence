using System.Data.Common;
using Dapper;
using BusinessIntelligence.Api.Models;

namespace BusinessIntelligence.Api.Services;

public sealed class QueryService
{
    private readonly DbConnectionFactory _factory;

    public QueryService(DbConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task TestConnectionAsync(DbProvider provider, string connectionString)
    {
        await using var conn = _factory.Create(provider, connectionString);
        await conn.OpenAsync();

        // works for both Postgres and SQL Server
        _ = await conn.ExecuteScalarAsync<int>("select 1");
    }

    public async Task<ExecuteQueryResponse> ExecuteSelectAsync(ConnectionDefinition def, string sql)
    {
        SqlGuard.EnsureSelectOnly(sql);

        await using var conn = _factory.Create(def.Provider, def.ConnectionString);
        await conn.OpenAsync();

        var rows = (await conn.QueryAsync(sql)).ToList();
        var dictRows = rows.Select(ToDictionary).ToList();

        var columns = dictRows.FirstOrDefault()?.Keys.ToArray() ?? [];
        return new ExecuteQueryResponse(columns, dictRows, dictRows.Count);
    }

    public async Task<ExecuteQueryResponse> ExecuteSelectAsync(ConnectionDefinition def, string sql, object? parameters)
    {
        SqlGuard.EnsureSelectOnly(sql);

        await using var conn = _factory.Create(def.Provider, def.ConnectionString);
        await conn.OpenAsync();

        var rows = (await conn.QueryAsync(sql, parameters)).ToList();
        var dictRows = rows.Select(ToDictionary).ToList();

        var columns = dictRows.FirstOrDefault()?.Keys.ToArray() ?? [];
        return new ExecuteQueryResponse(columns, dictRows, dictRows.Count);
    }

    public async Task<ExecuteQueryResponse> ExecuteChartAsync(ConnectionDefinition def, ChartQueryRequest req)
    {
        // chartType is currently informational; we only implement "bar" shape: dimension/value
        var agg = req.Aggregation?.Trim().ToUpperInvariant();
        var allowed = new HashSet<string> { "SUM", "COUNT", "AVG", "MIN", "MAX" };
        if (agg is null || !allowed.Contains(agg))
            throw new InvalidOperationException("Invalid aggregation.");

        SqlIdentifier.EnsureValid(req.SourceTable, nameof(req.SourceTable));
        SqlIdentifier.EnsureValid(req.Dimension, nameof(req.Dimension));
        if (req.Measure != "*") SqlIdentifier.EnsureValid(req.Measure, nameof(req.Measure));
        if (req.Measures is { Count: > 0 })
        {
            foreach (var m in req.Measures)
            {
                if (m != "*") SqlIdentifier.EnsureValid(m, "measure");
            }
        }

        var tableExpr = SqlIdentifier.Quote(def.Provider, req.SourceTable);
        var dimExpr = SqlIdentifier.Quote(def.Provider, req.Dimension);
        var measures = (req.Measures is { Count: > 0 } ? req.Measures : new[] { req.Measure })
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(6)
            .ToList();
        if (measures.Count == 0) measures.Add(req.Measure);

        int? limit = req.Limit is null ? null : Math.Clamp(req.Limit.Value, 1, 1000);

        // Build select list:
        // dimension + aggregated measures (aliases: original column name, or "value" for single measure)
        var selectAggs = new List<string>();
        for (var idx = 0; idx < measures.Count; idx++)
        {
            var m = measures[idx]!;
            var expr = m == "*" ? "*" : SqlIdentifier.Quote(def.Provider, m);
            var alias = measures.Count == 1 ? "value" : m;
            var aliased = def.Provider == DbProvider.Postgres
                ? $"{agg}({expr}) as \"{alias}\""
                : $"{agg}({expr}) as [{alias}]";
            selectAggs.Add(aliased);
        }

        var selectAggSql = string.Join(",\n  ", selectAggs);

        // Filters (cross-filter): WHERE col IN (...)
        var whereParts = new List<string>();
        var parameters = new DynamicParameters();
        if (req.Filters is { Count: > 0 })
        {
            var fIdx = 0;
            foreach (var f in req.Filters.Take(8))
            {
                if (string.IsNullOrWhiteSpace(f.Column)) continue;
                SqlIdentifier.EnsureValid(f.Column, "filter.column");

                var values = (f.Values ?? [])
                    .Where(v => !string.IsNullOrWhiteSpace(v))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .Take(50)
                    .ToList();
                if (values.Count == 0) continue;

                var colExpr = SqlIdentifier.Quote(def.Provider, f.Column);
                var pNames = new List<string>(values.Count);
                for (var i = 0; i < values.Count; i++)
                {
                    var pName = $"f{fIdx}_{i}";
                    pNames.Add("@" + pName);
                    parameters.Add(pName, values[i]);
                }

                whereParts.Add($"{colExpr} in ({string.Join(", ", pNames)})");
                fIdx++;
            }
        }

        var whereSql = whereParts.Count > 0 ? "where " + string.Join(" and ", whereParts) : "";

        string sql = def.Provider switch
        {
            DbProvider.Postgres => $@"
select
  {dimExpr} as ""dimension"",
  {selectAggSql}
from {tableExpr}
{whereSql}
group by {dimExpr}
order by 2 desc
{(limit is not null ? $"limit {limit}" : "")}
".Trim(),

            DbProvider.SqlServer => $@"
select {(limit is not null ? $"top ({limit})" : "")}
  {dimExpr} as [dimension],
  {selectAggSql}
from {tableExpr}
{whereSql}
group by {dimExpr}
order by 2 desc
".Trim(),

            _ => throw new ArgumentOutOfRangeException(),
        };

        return await ExecuteSelectAsync(def, sql, parameters.ParameterNames.Any() ? parameters : null);
    }

    public async Task<DistinctValuesResponse> GetDistinctValuesAsync(ConnectionDefinition def, DistinctValuesRequest req)
    {
        SqlIdentifier.EnsureValid(req.SourceTable, nameof(req.SourceTable));
        SqlIdentifier.EnsureValid(req.Column, nameof(req.Column));

        var tableExpr = SqlIdentifier.Quote(def.Provider, req.SourceTable);
        var colExpr = SqlIdentifier.Quote(def.Provider, req.Column);

        var limit = req.Limit is null ? 150 : Math.Clamp(req.Limit.Value, 1, 500);

        var whereParts = new List<string>();
        var parameters = new DynamicParameters();

        // Optional: search
        if (!string.IsNullOrWhiteSpace(req.Search))
        {
            var p = "search";
            var term = $"%{req.Search.Trim()}%";
            parameters.Add(p, term);
            whereParts.Add(def.Provider == DbProvider.Postgres ? $"{colExpr} ilike @{p}" : $"{colExpr} like @{p}");
        }

        // Filters (cross-filter): WHERE col IN (...)
        if (req.Filters is { Count: > 0 })
        {
            var fIdx = 0;
            foreach (var f in req.Filters.Take(8))
            {
                if (string.IsNullOrWhiteSpace(f.Column)) continue;
                SqlIdentifier.EnsureValid(f.Column, "filter.column");

                var values = (f.Values ?? [])
                    .Where(v => !string.IsNullOrWhiteSpace(v))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .Take(50)
                    .ToList();
                if (values.Count == 0) continue;

                var fColExpr = SqlIdentifier.Quote(def.Provider, f.Column);
                var pNames = new List<string>(values.Count);
                for (var i = 0; i < values.Count; i++)
                {
                    var pName = $"f{fIdx}_{i}";
                    pNames.Add("@" + pName);
                    parameters.Add(pName, values[i]);
                }

                whereParts.Add($"{fColExpr} in ({string.Join(", ", pNames)})");
                fIdx++;
            }
        }

        var whereSql = whereParts.Count > 0 ? "where " + string.Join(" and ", whereParts) : "";

        var sql = def.Provider switch
        {
            DbProvider.Postgres => $@"
select distinct {colExpr} as ""value""
from {tableExpr}
{whereSql}
order by 1 asc
limit {limit}
".Trim(),

            DbProvider.SqlServer => $@"
select top ({limit}) {colExpr} as [value]
from {tableExpr}
{whereSql}
group by {colExpr}
order by 1 asc
".Trim(),

            _ => throw new ArgumentOutOfRangeException(),
        };

        await using var conn = _factory.Create(def.Provider, def.ConnectionString);
        await conn.OpenAsync();

        var rows = (await conn.QueryAsync<string>(sql, parameters.ParameterNames.Any() ? parameters : null)).ToList();
        return new DistinctValuesResponse(rows);
    }

    public async Task<KpiQueryResponse> ExecuteKpiAsync(ConnectionDefinition def, KpiQueryRequest req)
    {
        var agg = req.Aggregation?.Trim().ToUpperInvariant();
        var allowed = new HashSet<string> { "SUM", "COUNT", "AVG", "MIN", "MAX" };
        if (agg is null || !allowed.Contains(agg))
            throw new InvalidOperationException("Invalid aggregation.");

        SqlIdentifier.EnsureValid(req.SourceTable, nameof(req.SourceTable));

        var measure = req.Measure?.Trim() ?? "*";
        if (measure == "*" && agg != "COUNT")
            throw new InvalidOperationException("Measure '*' is only allowed with COUNT.");
        if (measure != "*" && !string.IsNullOrWhiteSpace(measure))
            SqlIdentifier.EnsureValid(measure, nameof(req.Measure));

        var tableExpr = SqlIdentifier.Quote(def.Provider, req.SourceTable);
        var expr = measure == "*" ? "*" : SqlIdentifier.Quote(def.Provider, measure);

        var whereParts = new List<string>();
        var parameters = new DynamicParameters();
        if (req.Filters is { Count: > 0 })
        {
            var fIdx = 0;
            foreach (var f in req.Filters.Take(8))
            {
                if (string.IsNullOrWhiteSpace(f.Column)) continue;
                SqlIdentifier.EnsureValid(f.Column, "filter.column");

                var values = (f.Values ?? [])
                    .Where(v => !string.IsNullOrWhiteSpace(v))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .Take(50)
                    .ToList();
                if (values.Count == 0) continue;

                var colExpr = SqlIdentifier.Quote(def.Provider, f.Column);
                var pNames = new List<string>(values.Count);
                for (var i = 0; i < values.Count; i++)
                {
                    var pName = $"f{fIdx}_{i}";
                    pNames.Add("@" + pName);
                    parameters.Add(pName, values[i]);
                }

                whereParts.Add($"{colExpr} in ({string.Join(", ", pNames)})");
                fIdx++;
            }
        }

        var whereSql = whereParts.Count > 0 ? "where " + string.Join(" and ", whereParts) : "";
        var sql = def.Provider switch
        {
            DbProvider.Postgres => $@"select {agg}({expr}) as ""value"" from {tableExpr} {whereSql}".Trim(),
            DbProvider.SqlServer => $@"select {agg}({expr}) as [value] from {tableExpr} {whereSql}".Trim(),
            _ => throw new ArgumentOutOfRangeException(),
        };

        await using var conn = _factory.Create(def.Provider, def.ConnectionString);
        await conn.OpenAsync();

        var value = await conn.ExecuteScalarAsync<object?>(sql, parameters.ParameterNames.Any() ? parameters : null);
        return new KpiQueryResponse(value);
    }

    public async Task<IReadOnlyList<Dictionary<string, object?>>> SampleTableAsync(
        ConnectionDefinition def,
        string table,
        IReadOnlyList<string> columns,
        int rowLimit = 5)
    {
        SqlIdentifier.EnsureValid(table, nameof(table));
        foreach (var c in columns) SqlIdentifier.EnsureValid(c, "column");

        var safeLimit = Math.Clamp(rowLimit, 1, 10);
        var safeCols = columns.Take(12).ToList();
        if (safeCols.Count == 0) return [];

        var tableExpr = SqlIdentifier.Quote(def.Provider, table);
        var colExprs = safeCols.Select(c => SqlIdentifier.Quote(def.Provider, c));
        var selectCols = string.Join(", ", colExprs);

        var sql = def.Provider switch
        {
            DbProvider.Postgres => $@"select {selectCols} from {tableExpr} limit {safeLimit}",
            DbProvider.SqlServer => $@"select top ({safeLimit}) {selectCols} from {tableExpr}",
            _ => throw new ArgumentOutOfRangeException(),
        };

        await using var conn = _factory.Create(def.Provider, def.ConnectionString);
        await conn.OpenAsync();

        var rows = (await conn.QueryAsync(sql)).ToList();
        var dictRows = rows.Select(ToDictionary).ToList();

        // truncate very large string values to keep prompt small
        foreach (var r in dictRows)
        {
            foreach (var k in r.Keys.ToList())
            {
                if (r[k] is string s && s.Length > 120)
                    r[k] = s.Substring(0, 120) + "…";
            }
        }

        return dictRows;
    }

    private static Dictionary<string, object?> ToDictionary(object row)
    {
        if (row is IDictionary<string, object?> d)
            return new Dictionary<string, object?>(d, StringComparer.OrdinalIgnoreCase);

        // DapperRow implements IDictionary<string, object>
        if (row is IDictionary<string, object> d2)
            return d2.ToDictionary(k => k.Key, v => (object?)v.Value, StringComparer.OrdinalIgnoreCase);

        // fallback: reflect properties
        var result = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var prop in row.GetType().GetProperties())
        {
            result[prop.Name] = prop.GetValue(row);
        }
        return result;
    }
}


