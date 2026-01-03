using BusinessIntelligence.Api.Data;
using BusinessIntelligence.Api.Data.Entities;
using BusinessIntelligence.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace BusinessIntelligence.Api.Services;

public sealed class EfConnectionStore : IConnectionStore
{
    private readonly BiConfigDbContext _db;

    public EfConnectionStore(BiConfigDbContext db)
    {
        _db = db;
    }

    public ConnectionDefinition? Get(string id)
    {
        var e = _db.Connections.AsNoTracking().FirstOrDefault(x => x.Id == id);
        return e is null ? null : ToModel(e);
    }

    public IReadOnlyList<ConnectionDefinition> GetAll()
    {
        return _db.Connections.AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => ToModel(x))
            .ToList();
    }

    public void Upsert(ConnectionDefinition def)
    {
        var provider = ProviderToString(def.Provider);

        var existing = _db.Connections.FirstOrDefault(x => x.Id == def.Id);
        if (existing is null)
        {
            _db.Connections.Add(new ConnectionEntity
            {
                Id = def.Id,
                Name = def.Name,
                Provider = provider,
                ConnectionString = def.ConnectionString,
                CreatedAtUtc = DateTime.UtcNow,
            });
        }
        else
        {
            existing.Name = def.Name;
            existing.Provider = provider;
            existing.ConnectionString = def.ConnectionString;
        }

        _db.SaveChanges();
    }

    private static ConnectionDefinition ToModel(ConnectionEntity e)
    {
        return new ConnectionDefinition(
            Id: e.Id,
            Name: e.Name,
            Provider: StringToProvider(e.Provider),
            ConnectionString: e.ConnectionString
        );
    }

    private static DbProvider StringToProvider(string provider) =>
        provider.Trim().ToLowerInvariant() switch
        {
            "postgres" => DbProvider.Postgres,
            "sqlserver" => DbProvider.SqlServer,
            "sqlServer" => DbProvider.SqlServer,
            _ => throw new InvalidOperationException($"Unknown provider: {provider}"),
        };

    private static string ProviderToString(DbProvider provider) =>
        provider switch
        {
            DbProvider.Postgres => "postgres",
            DbProvider.SqlServer => "sqlServer",
            _ => throw new ArgumentOutOfRangeException(nameof(provider), provider, "Unknown provider"),
        };
}


