using System.Security.Cryptography;
using System.Text;
using BusinessIntelligence.Api.Data;
using BusinessIntelligence.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace BusinessIntelligence.Api.Services;

public sealed class OtpService
{
    private readonly BiConfigDbContext _db;

    public OtpService(BiConfigDbContext db)
    {
        _db = db;
    }

    public async Task<(string code, AuthOtpEntity entity)> CreateAsync(string userId, AuthOtpPurpose purpose, TimeSpan ttl)
    {
        // Invalidate any previous active codes for same user + purpose
        var now = DateTime.UtcNow;
        var old = await _db.AuthOtps
            .Where(x => x.UserId == userId && x.Purpose == purpose && x.ConsumedAtUtc == null && x.ExpiresAtUtc > now)
            .ToListAsync();
        foreach (var o in old) o.ConsumedAtUtc = now;

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var saltBytes = RandomNumberGenerator.GetBytes(16);
        var salt = Convert.ToBase64String(saltBytes);
        var hash = Hash(saltBytes, code);

        var entity = new AuthOtpEntity
        {
            Id = Guid.NewGuid().ToString("N"),
            UserId = userId,
            Purpose = purpose,
            Salt = salt,
            CodeHash = hash,
            AttemptCount = 0,
            CreatedAtUtc = now,
            ExpiresAtUtc = now.Add(ttl),
            ConsumedAtUtc = null,
        };

        _db.AuthOtps.Add(entity);
        await _db.SaveChangesAsync();
        return (code, entity);
    }

    public async Task<bool> VerifyAsync(string userId, AuthOtpPurpose purpose, string code, int maxAttempts = 5)
    {
        var now = DateTime.UtcNow;
        var otp = await _db.AuthOtps
            .Where(x => x.UserId == userId && x.Purpose == purpose && x.ConsumedAtUtc == null && x.ExpiresAtUtc > now)
            .OrderByDescending(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync();

        if (otp is null) return false;
        if (otp.AttemptCount >= maxAttempts)
        {
            otp.ConsumedAtUtc = now;
            await _db.SaveChangesAsync();
            return false;
        }

        otp.AttemptCount += 1;
        var saltBytes = Convert.FromBase64String(otp.Salt);
        var hash = Hash(saltBytes, code);
        var ok = SlowEquals(hash, otp.CodeHash);
        if (ok) otp.ConsumedAtUtc = now;

        await _db.SaveChangesAsync();
        return ok;
    }

    private static string Hash(byte[] saltBytes, string code)
    {
        var bytes = new byte[saltBytes.Length + Encoding.UTF8.GetByteCount(code)];
        Buffer.BlockCopy(saltBytes, 0, bytes, 0, saltBytes.Length);
        Encoding.UTF8.GetBytes(code, 0, code.Length, bytes, saltBytes.Length);
        var hashed = SHA256.HashData(bytes);
        return Convert.ToBase64String(hashed);
    }

    private static bool SlowEquals(string a, string b)
    {
        var ba = Encoding.UTF8.GetBytes(a);
        var bb = Encoding.UTF8.GetBytes(b);
        return CryptographicOperations.FixedTimeEquals(ba, bb);
    }
}


