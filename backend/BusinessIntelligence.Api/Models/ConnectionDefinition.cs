namespace BusinessIntelligence.Api.Models;

public record ConnectionDefinition(
    string Id,
    string Name,
    DbProvider Provider,
    string ConnectionString
);


