using BusinessIntelligence.Api.Data;
using BusinessIntelligence.Api.Data.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace BusinessIntelligence.Api.Services;

public sealed class AuthService
{
    private readonly BiConfigDbContext _db;
    private readonly PasswordHasher<UserEntity> _hasher = new();

    public AuthService(BiConfigDbContext db)
    {
        _db = db;
    }

    public async Task<UserEntity?> FindByEmailAsync(string email)
    {
        var norm = NormalizeEmail(email);
        return await _db.Users.FirstOrDefaultAsync(x => x.Email == norm);
    }

    public async Task<UserEntity> CreateUserAsync(string email, string password)
    {
        var norm = NormalizeEmail(email);
        var existing = await _db.Users.AnyAsync(x => x.Email == norm);
        if (existing) throw new InvalidOperationException("Email already registered.");

        var u = new UserEntity
        {
            Id = Guid.NewGuid().ToString("N"),
            Email = norm,
            PasswordHash = "",
            CreatedAtUtc = DateTime.UtcNow,
            EmailVerifiedAtUtc = null,
        };
        u.PasswordHash = _hasher.HashPassword(u, password);

        _db.Users.Add(u);
        await _db.SaveChangesAsync();
        return u;
    }

    public bool VerifyPassword(UserEntity user, string password)
    {
        var res = _hasher.VerifyHashedPassword(user, user.PasswordHash, password);
        return res is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
    }

    public async Task SetPasswordAsync(UserEntity user, string newPassword)
    {
        user.PasswordHash = _hasher.HashPassword(user, newPassword);
        await _db.SaveChangesAsync();
    }

    public async Task MarkEmailVerifiedAsync(UserEntity user)
    {
        if (user.EmailVerifiedAtUtc is null)
            user.EmailVerifiedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}


