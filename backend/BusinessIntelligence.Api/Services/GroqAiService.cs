using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using BusinessIntelligence.Api.Models;
using System.Collections.Generic;

namespace BusinessIntelligence.Api.Services;

public sealed class GroqAiService
{
    private readonly HttpClient _http;
    private readonly IConfiguration _cfg;

    public GroqAiService(HttpClient http, IConfiguration cfg)
    {
        _http = http;
        _cfg = cfg;
    }

    public Task<AiChatResponse> ChatAsync(AiChatRequest req, CancellationToken ct) =>
        ChatAsync(req, extraContext: null, ct);

    public async Task<AiChatResponse> ChatAsync(AiChatRequest req, string? extraContext, CancellationToken ct)
    {
        var apiKey =
            _cfg["Groq:ApiKey"]
            ?? Environment.GetEnvironmentVariable("GROQ_API_KEY");

        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("Missing GROQ_API_KEY (or Groq:ApiKey).");

        var model =
            _cfg["Groq:Model"]
            ?? "openai/gpt-oss-120b";

        var systemPrompt = """
You are a BI assistant inside a dashboard designer (QlikSense-like).
Your job:
- Ask 1-2 clarifying questions if needed (keep it short).
- Suggest the best chart type(s) and field mapping (dimension/measure/aggregation).
- If the user mentions tables (prefixed with @), propose which table(s) to use.
- Output suggestions as bullet points. When useful, include a ChartQueryRequest JSON snippet the app can send to backend.
Constraints:
- Do not invent columns you are not sure exist. If unknown, ask the user to pick columns from the schema list.
""";

        // Provide minimal context about mentions
        var mentions = (req.MentionedTables is { Count: > 0 })
            ? $"Mentioned tables: {string.Join(", ", req.MentionedTables)}"
            : null;

        var messages = new List<object>
        {
            new { role = "system", content = systemPrompt },
        };
        if (!string.IsNullOrWhiteSpace(mentions))
            messages.Add(new { role = "system", content = mentions });
        if (!string.IsNullOrWhiteSpace(extraContext))
            messages.Add(new { role = "system", content = extraContext });
        messages.Add(new { role = "user", content = req.Message });

        var payload = new
        {
            model,
            messages,
            temperature = 0.2,
        };

        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        });

        using var httpReq = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
        httpReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        httpReq.Content = new StringContent(json, Encoding.UTF8, "application/json");

        using var resp = await _http.SendAsync(httpReq, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"Groq error ({(int)resp.StatusCode}): {body}");

        using var doc = JsonDocument.Parse(body);
        var content =
            doc.RootElement
               .GetProperty("choices")[0]
               .GetProperty("message")
               .GetProperty("content")
               .GetString() ?? "";

        return new AiChatResponse(model, content);
    }
}


