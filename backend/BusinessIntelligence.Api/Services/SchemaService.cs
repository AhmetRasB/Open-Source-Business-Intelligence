using Dapper;
using BusinessIntelligence.Api.Models;

namespace BusinessIntelligence.Api.Services;

public sealed class SchemaService
{
    private readonly DbConnectionFactory _factory;

    public SchemaService(DbConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<IReadOnlyList<string>> GetTablesAsync(ConnectionDefinition def)
    {
        await using var conn = _factory.Create(def.Provider, def.ConnectionString);
        await conn.OpenAsync();

        return def.Provider switch
        {
            DbProvider.Postgres => (await conn.QueryAsync<string>(
                """
                select table_schema || '.' || table_name
                from information_schema.tables
                where table_type = 'BASE TABLE'
                  and table_schema not in ('pg_catalog', 'information_schema')
                order by table_schema, table_name
                """)).ToList(),

            DbProvider.SqlServer => (await conn.QueryAsync<string>(
                """
                select table_schema + '.' + table_name
                from information_schema.tables
                where table_type = 'BASE TABLE'
                order by table_schema, table_name
                """)).ToList(),

            _ => throw new ArgumentOutOfRangeException(),
        };
    }

    public record ColumnInfo(string Name, string DataType);

    public async Task<IReadOnlyList<ColumnInfo>> GetColumnsAsync(ConnectionDefinition def, string table)
    {
        SqlIdentifier.EnsureValid(table, nameof(table));

        var schema = def.Provider == DbProvider.Postgres ? "public" : "dbo";
        var tableName = table;
        if (table.Contains('.'))
        {
            var parts = table.Split('.', StringSplitOptions.RemoveEmptyEntries);
            schema = parts[0]!;
            tableName = parts[1]!;
        }

        await using var conn = _factory.Create(def.Provider, def.ConnectionString);
        await conn.OpenAsync();

        return def.Provider switch
        {
            DbProvider.Postgres => (await conn.QueryAsync<ColumnInfo>(
                """
                select column_name as "Name", data_type as "DataType"
                from information_schema.columns
                where table_schema = @schema and table_name = @tableName
                order by ordinal_position
                """,
                new { schema, tableName })).ToList(),

            DbProvider.SqlServer => (await conn.QueryAsync<ColumnInfo>(
                """
                select column_name as [Name], data_type as [DataType]
                from information_schema.columns
                where table_schema = @schema and table_name = @tableName
                order by ordinal_position
                """,
                new { schema, tableName })).ToList(),

            _ => throw new ArgumentOutOfRangeException(),
        };
    }
}


