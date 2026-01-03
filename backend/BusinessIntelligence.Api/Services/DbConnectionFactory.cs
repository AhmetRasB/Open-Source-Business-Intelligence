using System.Data.Common;
using BusinessIntelligence.Api.Models;
using Microsoft.Data.SqlClient;
using Npgsql;

namespace BusinessIntelligence.Api.Services;

public sealed class DbConnectionFactory
{
    public DbConnection Create(DbProvider provider, string connectionString)
    {
        return provider switch
        {
            DbProvider.Postgres => new NpgsqlConnection(connectionString),
            DbProvider.SqlServer => new SqlConnection(connectionString),
            _ => throw new ArgumentOutOfRangeException(nameof(provider), provider, "Unsupported provider"),
        };
    }
}


