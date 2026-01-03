namespace BusinessIntelligence.Api.Models;

public record AiChatRequest(
    string Message,
    string? ConnectionId,
    IReadOnlyList<string>? MentionedTables
);

public record AiChatResponse(
    string Model,
    string Content
);


