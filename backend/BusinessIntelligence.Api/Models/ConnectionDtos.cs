namespace BusinessIntelligence.Api.Models;

public record ConnectionDto(string Id, string Name, DbProvider Provider);

public record CreateConnectionRequest(string Name, DbProvider Provider, string ConnectionString);

public record TestConnectionRequest(DbProvider Provider, string ConnectionString);


