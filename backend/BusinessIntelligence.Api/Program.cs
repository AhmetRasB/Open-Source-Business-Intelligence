using BusinessIntelligence.Api.Models;
using BusinessIntelligence.Api.Services;
using System.Text.Json;
using System.Text.Json.Serialization;
using BusinessIntelligence.Api.Data;
using BusinessIntelligence.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Security.Claims;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
});

// Auth (JWT)
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        var key = builder.Configuration["Jwt:Key"] ?? "DEV_ONLY_CHANGE_ME_please_use_a_long_random_string_32+chars";
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "BusinessIntelligenceApp",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "BusinessIntelligenceApp",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("dev", p =>
    {
        // Vite dev server (default)
        p.WithOrigins(
                "http://localhost:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5173",
                "http://127.0.0.1:5174"
            )
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var configDbConn = builder.Configuration.GetConnectionString("ConfigDb");
if (string.IsNullOrWhiteSpace(configDbConn))
    throw new InvalidOperationException("Missing ConnectionStrings:ConfigDb");

builder.Services.AddDbContext<BiConfigDbContext>(o => o.UseSqlServer(configDbConn));
builder.Services.AddScoped<IConnectionStore, EfConnectionStore>();
builder.Services.AddSingleton<DbConnectionFactory>();
builder.Services.AddSingleton<SchemaService>();
builder.Services.AddSingleton<QueryService>();
builder.Services.AddHttpClient<GroqAiService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<OtpService>();
builder.Services.AddScoped<JwtService>();
builder.Services.AddHttpClient<EmailService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseCors("dev");
}

app.UseAuthentication();
app.UseAuthorization();

// Auto-apply migrations (dev convenience)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BiConfigDbContext>();
    db.Database.Migrate();
}

// We rely on http://localhost:5208 for local dev; keep HTTPS available but don't force redirects.
// app.UseHttpsRedirection();

var api = app.MapGroup("/api").WithOpenApi();
var auth = api.MapGroup("/auth").WithOpenApi();

auth.MapPost("/register", async (RegisterRequest req, AuthService authService, OtpService otp, EmailService email, IHostEnvironment env, ILoggerFactory loggerFactory) =>
{
    DomainPolicy.EnsureAllowedEmail(req.Email);
    if (req.Password.Length < 8) return Results.BadRequest(new { message = "Password must be at least 8 characters." });
    var log = loggerFactory.CreateLogger("Auth");

    // If user already exists:
    // - verified => tell them to login
    // - not verified => re-send verification code (nice UX)
    var existing = await authService.FindByEmailAsync(req.Email);
    if (existing is not null)
    {
        if (existing.EmailVerifiedAtUtc is not null)
            return Results.Conflict(new { message = "Email already registered. Please login." });

        var (code, _) = await otp.CreateAsync(existing.Id, AuthOtpPurpose.Signup, TimeSpan.FromMinutes(10));
        try
        {
            await email.SendAsync(existing.Email, "Teklas BI - Verify your email", $"Your verification code is: {code}\n\nThis code expires in 10 minutes.");
            return Results.Ok(new { ok = true, resent = true });
        }
        catch (Exception ex) when (env.IsDevelopment())
        {
            // Mailtrap demo accounts often refuse sending to non-owner domains (403).
            // In dev, unblock the flow by returning the code so you can continue testing.
            log.LogWarning(ex, "Email send failed during signup resend; returning devCode.");
            return Results.Ok(new { ok = true, resent = true, emailFailed = true, devCode = code });
        }
    }

    try
    {
        var user = await authService.CreateUserAsync(req.Email, req.Password);
        var (code, _) = await otp.CreateAsync(user.Id, AuthOtpPurpose.Signup, TimeSpan.FromMinutes(10));
        try
        {
            await email.SendAsync(user.Email, "Teklas BI - Verify your email", $"Your verification code is: {code}\n\nThis code expires in 10 minutes.");
            return Results.Ok(new { ok = true });
        }
        catch (Exception ex) when (env.IsDevelopment())
        {
            log.LogWarning(ex, "Email send failed during signup; returning devCode.");
            return Results.Ok(new { ok = true, emailFailed = true, devCode = code });
        }
    }
    catch (InvalidOperationException ex) when (ex.Message.Contains("already", StringComparison.OrdinalIgnoreCase))
    {
        // Race condition: another request created the user in between our check and insert.
        return Results.Conflict(new { message = "Email already registered. Please login." });
    }
});

auth.MapPost("/verify-email", async (VerifyEmailRequest req, AuthService authService, OtpService otp, JwtService jwt) =>
{
    DomainPolicy.EnsureAllowedEmail(req.Email);
    var user = await authService.FindByEmailAsync(req.Email);
    if (user is null) return Results.BadRequest(new { message = "Invalid email or code." });

    var ok = await otp.VerifyAsync(user.Id, AuthOtpPurpose.Signup, req.Code);
    if (!ok) return Results.BadRequest(new { message = "Invalid email or code." });

    await authService.MarkEmailVerifiedAsync(user);
    var (token, exp) = jwt.Issue(user);
    return Results.Ok(new AuthTokenResponse(token, exp));
});

auth.MapPost("/login", async (LoginRequest req, AuthService authService, OtpService otp, EmailService email, IHostEnvironment env, ILoggerFactory loggerFactory) =>
{
    DomainPolicy.EnsureAllowedEmail(req.Email);
    var user = await authService.FindByEmailAsync(req.Email);
    if (user is null) return Results.BadRequest(new { message = "Invalid credentials." });
    if (user.EmailVerifiedAtUtc is null) return Results.BadRequest(new { message = "Email is not verified." });
    if (!authService.VerifyPassword(user, req.Password)) return Results.BadRequest(new { message = "Invalid credentials." });

    // Always send login code (2FA every sign-in)
    var (code, _) = await otp.CreateAsync(user.Id, AuthOtpPurpose.Login, TimeSpan.FromMinutes(10));
    var log = loggerFactory.CreateLogger("Auth");
    try
    {
        await email.SendAsync(user.Email, "Teklas BI - Login code", $"Your login code is: {code}\n\nThis code expires in 10 minutes.");
        return Results.Ok(new { requiresCode = true });
    }
    catch (Exception ex) when (env.IsDevelopment())
    {
        log.LogWarning(ex, "Email send failed during login; returning devCode.");
        return Results.Ok(new { requiresCode = true, emailFailed = true, devCode = code });
    }
});

auth.MapPost("/login/verify", async (VerifyLoginCodeRequest req, AuthService authService, OtpService otp, JwtService jwt) =>
{
    DomainPolicy.EnsureAllowedEmail(req.Email);
    var user = await authService.FindByEmailAsync(req.Email);
    if (user is null) return Results.BadRequest(new { message = "Invalid email or code." });
    if (user.EmailVerifiedAtUtc is null) return Results.BadRequest(new { message = "Email is not verified." });

    var ok = await otp.VerifyAsync(user.Id, AuthOtpPurpose.Login, req.Code);
    if (!ok) return Results.BadRequest(new { message = "Invalid email or code." });

    var (token, exp) = jwt.Issue(user);
    return Results.Ok(new AuthTokenResponse(token, exp));
});

auth.MapPost("/forgot-password", async (ForgotPasswordRequest req, AuthService authService, OtpService otp, EmailService email, IHostEnvironment env, ILoggerFactory loggerFactory) =>
{
    // Do not leak whether email exists; still enforce domain policy for intent.
    DomainPolicy.EnsureAllowedEmail(req.Email);
    var user = await authService.FindByEmailAsync(req.Email);
    if (user is not null)
    {
        var (code, _) = await otp.CreateAsync(user.Id, AuthOtpPurpose.ResetPassword, TimeSpan.FromMinutes(10));
        var log = loggerFactory.CreateLogger("Auth");
        try
        {
            await email.SendAsync(user.Email, "Teklas BI - Reset password code", $"Your password reset code is: {code}\n\nThis code expires in 10 minutes.");
        }
        catch (Exception ex) when (env.IsDevelopment())
        {
            log.LogWarning(ex, "Email send failed during forgot-password; returning devCode.");
            // Still return ok=true below to avoid email enumeration.
            return Results.Ok(new { ok = true, emailFailed = true, devCode = code });
        }
    }
    return Results.Ok(new { ok = true });
});

auth.MapPost("/reset-password", async (ResetPasswordRequest req, AuthService authService, OtpService otp) =>
{
    DomainPolicy.EnsureAllowedEmail(req.Email);
    if (req.NewPassword.Length < 8) return Results.BadRequest(new { message = "Password must be at least 8 characters." });

    var user = await authService.FindByEmailAsync(req.Email);
    if (user is null) return Results.BadRequest(new { message = "Invalid email or code." });

    var ok = await otp.VerifyAsync(user.Id, AuthOtpPurpose.ResetPassword, req.Code);
    if (!ok) return Results.BadRequest(new { message = "Invalid email or code." });

    await authService.SetPasswordAsync(user, req.NewPassword);
    return Results.Ok(new { ok = true });
});

auth.MapGet("/me", (ClaimsPrincipal user) =>
{
    var id = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
    var email = user.FindFirstValue(ClaimTypes.Email) ?? user.FindFirstValue("email");
    return Results.Ok(new { id, email });
}).RequireAuthorization();

// Connections
api.MapGet("/connections", (IConnectionStore store) =>
{
    var list = store.GetAll().Select(c => new ConnectionDto(c.Id, c.Name, c.Provider));
    return Results.Ok(list);
});

api.MapPost("/connections", async (CreateConnectionRequest req, IConnectionStore store, QueryService queryService) =>
{
    var def = new ConnectionDefinition(
        Id: Guid.NewGuid().ToString("N"),
        Name: req.Name.Trim(),
        Provider: req.Provider,
        ConnectionString: req.ConnectionString
    );

    // Validate by attempting connection
    await queryService.TestConnectionAsync(def.Provider, def.ConnectionString);

    store.Upsert(def);
    return Results.Ok(new ConnectionDto(def.Id, def.Name, def.Provider));
});

api.MapPost("/connections/test", async (TestConnectionRequest req, QueryService queryService) =>
{
    await queryService.TestConnectionAsync(req.Provider, req.ConnectionString);
    return Results.Ok(new { ok = true });
});

// Schema
api.MapGet("/schema/tables", async (string connectionId, IConnectionStore store, SchemaService schema) =>
{
    var def = store.Get(connectionId);
    if (def is null) return Results.NotFound(new { message = "Connection not found" });

    var tables = await schema.GetTablesAsync(def);
    return Results.Ok(tables.Select(t => new { name = t }));
});

api.MapGet("/schema/columns", async (string connectionId, string table, IConnectionStore store, SchemaService schema) =>
{
    var def = store.Get(connectionId);
    if (def is null) return Results.NotFound(new { message = "Connection not found" });

    var cols = await schema.GetColumnsAsync(def, table);
    return Results.Ok(cols.Select(c => new { name = c.Name, dataType = c.DataType }));
});

// Queries
api.MapPost("/query/execute", async (ExecuteQueryRequest req, IConnectionStore store, QueryService queryService) =>
{
    var def = store.Get(req.ConnectionId);
    if (def is null) return Results.NotFound(new { message = "Connection not found" });

    var res = await queryService.ExecuteSelectAsync(def, req.Sql);
    return Results.Ok(res);
});

api.MapPost("/query/chart", async (ChartQueryRequest req, IConnectionStore store, QueryService queryService) =>
{
    var def = store.Get(req.ConnectionId);
    if (def is null) return Results.NotFound(new { message = "Connection not found" });

    var res = await queryService.ExecuteChartAsync(def, req);
    return Results.Ok(res);
});

api.MapPost("/query/distinct", async (DistinctValuesRequest req, IConnectionStore store, QueryService queryService) =>
{
    var def = store.Get(req.ConnectionId);
    if (def is null) return Results.NotFound(new { message = "Connection not found" });

    var res = await queryService.GetDistinctValuesAsync(def, req);
    return Results.Ok(res);
});

api.MapPost("/query/kpi", async (KpiQueryRequest req, IConnectionStore store, QueryService queryService) =>
{
    var def = store.Get(req.ConnectionId);
    if (def is null) return Results.NotFound(new { message = "Connection not found" });

    var res = await queryService.ExecuteKpiAsync(def, req);
    return Results.Ok(res);
});

// AI (Groq OpenAI-compatible proxy)
api.MapPost("/ai/chat", async (AiChatRequest req, GroqAiService ai, IConnectionStore store, SchemaService schema, QueryService queryService, CancellationToken ct) =>
{
    // Optional: if connectionId is provided, enrich mentioned tables from schema for better suggestions
    List<string>? mentioned = null;
    string? extraContext = null;
    if (!string.IsNullOrWhiteSpace(req.ConnectionId))
    {
        var def = store.Get(req.ConnectionId);
        if (def is not null)
        {
            var tables = await schema.GetTablesAsync(def);
            mentioned = req.MentionedTables is { Count: > 0 }
                ? req.MentionedTables.Where(t => tables.Contains(t)).ToList()
                : null;

            // If user mentioned tables, provide schema + a small sample to the model so it knows columns.
            if (mentioned is { Count: > 0 })
            {
                var take = mentioned.Take(2).ToList(); // keep prompt small
                var parts = new List<string>();

                foreach (var t in take)
                {
                    var cols = await schema.GetColumnsAsync(def, t);
                    var colNames = cols.Select(c => c.Name).Take(12).ToList();
                    var colSummary = string.Join(", ", cols.Take(12).Select(c => $"{c.Name}:{c.DataType}"));

                    IReadOnlyList<Dictionary<string, object?>> sample = [];
                    try
                    {
                        sample = await queryService.SampleTableAsync(def, t, colNames, rowLimit: 5);
                    }
                    catch
                    {
                        // sampling is best-effort; schema alone is still useful
                    }

                    var sampleJson = JsonSerializer.Serialize(sample, new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                        WriteIndented = false,
                    });

                    parts.Add($"""
Table: {t}
Columns (first 12): {colSummary}
Sample rows (up to 5, first 12 cols): {sampleJson}
""");
                }

                extraContext = "Database context for mentioned tables:\n" + string.Join("\n", parts);
            }
        }
    }

    var res = await ai.ChatAsync(req with { MentionedTables = mentioned ?? req.MentionedTables }, extraContext, ct);
    return Results.Ok(res);
});

app.Run();
