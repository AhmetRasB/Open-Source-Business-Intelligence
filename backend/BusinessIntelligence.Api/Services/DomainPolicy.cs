namespace BusinessIntelligence.Api.Services;

public static class DomainPolicy
{
    private static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        "teklas.com",
        "teklas.com.tr",
    };

    public static void EnsureAllowedEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email)) throw new InvalidOperationException("Email is required.");
        var at = email.LastIndexOf('@');
        if (at <= 0 || at >= email.Length - 1) throw new InvalidOperationException("Invalid email.");
        var domain = email[(at + 1)..].Trim();
        if (!Allowed.Contains(domain))
            throw new InvalidOperationException("Only teklas.com and teklas.com.tr emails can sign in.");
    }
}


