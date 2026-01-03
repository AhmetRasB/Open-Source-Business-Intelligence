using System.Text.RegularExpressions;

namespace BusinessIntelligence.Api.Services;

public static class SqlGuard
{
    private static readonly Regex StartsWithSelectOrWith =
        new(@"^\s*(select|with)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex ForbiddenKeywords =
        new(@"\b(insert|update|delete|merge|drop|alter|create|truncate|grant|revoke)\b",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static void EnsureSelectOnly(string sql)
    {
        if (string.IsNullOrWhiteSpace(sql))
            throw new InvalidOperationException("SQL is empty.");

        if (!StartsWithSelectOrWith.IsMatch(sql))
            throw new InvalidOperationException("Only SELECT queries are allowed.");

        if (ForbiddenKeywords.IsMatch(sql))
            throw new InvalidOperationException("Query contains forbidden keywords.");

        // crude multi-statement guard: allow at most one trailing semicolon
        var trimmed = sql.Trim();
        var semicolons = trimmed.Count(c => c == ';');
        if (semicolons > 1) throw new InvalidOperationException("Multiple statements are not allowed.");
        if (semicolons == 1 && !trimmed.EndsWith(';'))
            throw new InvalidOperationException("Multiple statements are not allowed.");
    }
}


