using Microsoft.EntityFrameworkCore;

namespace CvForge.Api.Data;

/// <summary>
/// The database is created with EnsureCreated() rather than EF migrations, so a column added to
/// a model reaches fresh databases but never existing ones. This adds any missing column in place.
/// Idempotent: safe to run on every start, and a no-op on a database EnsureCreated() just built.
/// </summary>
public static class SchemaPatch
{
    private static readonly (string Table, string Column, string Ddl)[] Columns =
    {
        ("Blurbs", "SkillGroup", "TEXT NULL"),
        ("Blurbs", "Archived",   "INTEGER NOT NULL DEFAULT 0"),
    };

    public static void Apply(AppDbContext db)
    {
        foreach (var (table, column, ddl) in Columns)
        {
            // PRAGMA arguments can't be parameterized, and ALTER TABLE takes none at all. Every
            // value interpolated below comes from the literal table above, never from input.
#pragma warning disable EF1002
            var exists = db.Database
                .SqlQueryRaw<int>($"SELECT COUNT(*) AS Value FROM pragma_table_info('{table}') WHERE name = '{column}'")
                .AsEnumerable().First() > 0;
            if (!exists)
                db.Database.ExecuteSqlRaw($"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" {ddl}");
#pragma warning restore EF1002
        }
    }
}
