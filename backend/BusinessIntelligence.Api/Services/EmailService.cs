namespace BusinessIntelligence.Api.Services;

public sealed class EmailService
{
    private readonly IConfiguration _cfg;
    private readonly HttpClient _http;

    public EmailService(HttpClient http, IConfiguration cfg)
    {
        _http = http;
        _cfg = cfg;
    }

    public async Task SendAsync(string toEmail, string subject, string text)
    {
        // Prefer SMTP (Mailtrap Email Testing) when configured.
        var smtpHost = _cfg["Mailtrap:SmtpHost"] ?? Environment.GetEnvironmentVariable("MAILTRAP_SMTP_HOST");
        var smtpUser = _cfg["Mailtrap:SmtpUsername"] ?? Environment.GetEnvironmentVariable("MAILTRAP_SMTP_USERNAME");
        var smtpPass = _cfg["Mailtrap:SmtpPassword"] ?? Environment.GetEnvironmentVariable("MAILTRAP_SMTP_PASSWORD");
        var smtpPortStr = _cfg["Mailtrap:SmtpPort"] ?? Environment.GetEnvironmentVariable("MAILTRAP_SMTP_PORT");
        var smtpPort = int.TryParse(smtpPortStr, out var p) ? p : 2525;

        var fromEmail = _cfg["Mailtrap:FromEmail"] ?? "BI@teklas.com.tr";
        var fromName = _cfg["Mailtrap:FromName"] ?? "Teklas BI";

        if (!string.IsNullOrWhiteSpace(smtpHost) &&
            !string.IsNullOrWhiteSpace(smtpUser) &&
            !string.IsNullOrWhiteSpace(smtpPass))
        {
            using var msg = new System.Net.Mail.MailMessage();
            msg.From = new System.Net.Mail.MailAddress(fromEmail, fromName);
            msg.To.Add(new System.Net.Mail.MailAddress(toEmail));
            msg.Subject = subject;
            msg.Body = text;
            msg.IsBodyHtml = false;

            using var smtp = new System.Net.Mail.SmtpClient(smtpHost, smtpPort)
            {
                Credentials = new System.Net.NetworkCredential(smtpUser, smtpPass),
                EnableSsl = true, // Mailtrap supports STARTTLS
            };

            await smtp.SendMailAsync(msg);
            return;
        }

        // Fallback: Mailtrap Send API (may be restricted by plan/demo limitations).
        var token = _cfg["Mailtrap:ApiToken"] ?? Environment.GetEnvironmentVariable("MAILTRAP_API_TOKEN");
        if (string.IsNullOrWhiteSpace(token))
            throw new InvalidOperationException("Missing Mailtrap:ApiToken (or MAILTRAP_API_TOKEN).");

        var apiUrl = _cfg["Mailtrap:SendApiUrl"] ?? "https://send.api.mailtrap.io/api/send";

        using var req = new HttpRequestMessage(HttpMethod.Post, apiUrl);
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        req.Content = JsonContent.Create(new
        {
            from = new { email = fromEmail, name = fromName },
            to = new[] { new { email = toEmail } },
            subject,
            text,
        });

        using var resp = await _http.SendAsync(req);
        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Mail send failed ({(int)resp.StatusCode}): {body}");
        }
    }
}


