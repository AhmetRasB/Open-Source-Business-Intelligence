using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BusinessIntelligence.Api.Data.Entities;
using Microsoft.IdentityModel.Tokens;

namespace BusinessIntelligence.Api.Services;

public sealed class JwtService
{
    private readonly IConfiguration _cfg;

    public JwtService(IConfiguration cfg)
    {
        _cfg = cfg;
    }

    public (string token, DateTime expiresAtUtc) Issue(UserEntity user)
    {
        var issuer = _cfg["Jwt:Issuer"] ?? "BusinessIntelligenceApp";
        var audience = _cfg["Jwt:Audience"] ?? "BusinessIntelligenceApp";
        var key = _cfg["Jwt:Key"] ?? throw new InvalidOperationException("Missing Jwt:Key");
        var minutes = int.TryParse(_cfg["Jwt:ExpiresMinutes"], out var m) ? m : 60;

        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var creds = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        var expires = DateTime.UtcNow.AddMinutes(minutes);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
        };

        var jwt = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expires,
            signingCredentials: creds
        );

        return (new JwtSecurityTokenHandler().WriteToken(jwt), expires);
    }
}


