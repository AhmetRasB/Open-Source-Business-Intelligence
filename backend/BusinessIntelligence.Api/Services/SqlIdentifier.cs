using System.Text.RegularExpressions;
using BusinessIntelligence.Api.Models;

namespace BusinessIntelligence.Api.Services;

public static class SqlIdentifier
{
    private static readonly Regex Segment = new(@"^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.Compiled);

    public static void EnsureValid(string identifier, string paramName)
    {
        if (string.IsNullOrWhiteSpace(identifier))
            throw new InvalidOperationException($"{paramName} is empty.");

        foreach (var seg in identifier.Split('.', StringSplitOptions.RemoveEmptyEntries))
        {
            if (!Segment.IsMatch(seg))
                throw new InvalidOperationException($"{paramName} contains invalid identifier segment: '{seg}'.");
        }
    }

    public static string Quote(DbProvider provider, string identifier)
    {
        EnsureValid(identifier, nameof(identifier));

        var segments = identifier.Split('.', StringSplitOptions.RemoveEmptyEntries);
        return provider switch
        {
            DbProvider.Postgres => string.Join('.', segments.Select(s => $"\"{s}\"")),
            DbProvider.SqlServer => string.Join('.', segments.Select(s => $"[{s}]")),
            _ => throw new ArgumentOutOfRangeException(nameof(provider), provider, "Unsupported provider"),
        };
    }
}


