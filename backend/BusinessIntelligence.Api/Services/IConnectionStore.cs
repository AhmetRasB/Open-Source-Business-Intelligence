using BusinessIntelligence.Api.Models;

namespace BusinessIntelligence.Api.Services;

public interface IConnectionStore
{
    ConnectionDefinition? Get(string id);
    IReadOnlyList<ConnectionDefinition> GetAll();
    void Upsert(ConnectionDefinition def);
}


