using System.Text.Json;
using System.Text.Json.Serialization;
using BusinessIntelligence.Api.Models;

namespace BusinessIntelligence.Api.Services;

public sealed class FileConnectionStore : IConnectionStore
{
    private readonly object _lock = new();
    private readonly string _filePath;
    private List<ConnectionDefinition> _cache;

    public FileConnectionStore(IWebHostEnvironment env)
    {
        var dataDir = Path.Combine(env.ContentRootPath, "data");
        Directory.CreateDirectory(dataDir);

        _filePath = Path.Combine(dataDir, "connections.json");
        _cache = Load();
    }

    public ConnectionDefinition? Get(string id)
    {
        lock (_lock)
        {
            return _cache.FirstOrDefault(c => c.Id == id);
        }
    }

    public IReadOnlyList<ConnectionDefinition> GetAll()
    {
        lock (_lock)
        {
            return _cache.ToList();
        }
    }

    public void Upsert(ConnectionDefinition def)
    {
        lock (_lock)
        {
            var idx = _cache.FindIndex(c => c.Id == def.Id);
            if (idx >= 0) _cache[idx] = def;
            else _cache.Add(def);

            Save(_cache);
        }
    }

    private List<ConnectionDefinition> Load()
    {
        if (!File.Exists(_filePath)) return [];

        var json = File.ReadAllText(_filePath);
        if (string.IsNullOrWhiteSpace(json)) return [];

        return JsonSerializer.Deserialize<List<ConnectionDefinition>>(json, JsonOptions()) ?? [];
    }

    private void Save(List<ConnectionDefinition> list)
    {
        var json = JsonSerializer.Serialize(list, JsonOptions());
        File.WriteAllText(_filePath, json);
    }

    private static JsonSerializerOptions JsonOptions() => new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };
}


