namespace BusinessIntelligence.Api.Models;

public record RegisterRequest(string Email, string Password);
public record VerifyEmailRequest(string Email, string Code);
public record LoginRequest(string Email, string Password);
public record VerifyLoginCodeRequest(string Email, string Code);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Email, string Code, string NewPassword);

public record AuthTokenResponse(string AccessToken, DateTime ExpiresAtUtc);


