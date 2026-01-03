namespace BusinessIntelligence.Api.Models;

public record ExecuteQueryRequest(string ConnectionId, string Sql);

public record ExecuteQueryResponse(string[] Columns, IReadOnlyList<Dictionary<string, object?>> Rows, int RowCount);

public record ChartFilter(
    string Column,
    IReadOnlyList<string> Values
);

public record ChartQueryRequest(
    string ConnectionId,
    string ChartType,
    string SourceTable,
    string Dimension,
    string Measure,
    IReadOnlyList<string>? Measures,
    IReadOnlyList<ChartFilter>? Filters,
    string Aggregation,
    int? Limit
);

public record DistinctValuesRequest(
    string ConnectionId,
    string SourceTable,
    string Column,
    string? Search,
    int? Limit,
    IReadOnlyList<ChartFilter>? Filters
);

public record DistinctValuesResponse(IReadOnlyList<string> Values);

public record KpiQueryRequest(
    string ConnectionId,
    string SourceTable,
    string Measure,
    string Aggregation,
    IReadOnlyList<ChartFilter>? Filters
);

public record KpiQueryResponse(object? Value);


