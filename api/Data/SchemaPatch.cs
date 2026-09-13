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
        ("Blurbs", "Draft",      "INTEGER NOT NULL DEFAULT 0"),
    };

    public static void Apply(AppDbContext db)
    {
        foreach (var (table, column, ddl) in Columns)
            if (!ColumnExists(db, table, column))
                // ALTER TABLE takes no parameters; every interpolated value comes from the
                // literal table above, never from input.
#pragma warning disable EF1002
                db.Database.ExecuteSqlRaw($"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" {ddl}");
#pragma warning restore EF1002

        // One-off: "Locked" (true = polished) became "Draft" (true = unpolished, AI-authored).
        // Keyed on the legacy column itself so an interrupted migration finishes on the next
        // start. Locked must be dropped, not abandoned — it is NOT NULL without a default, so
        // inserts from the new model (which no longer supplies it) would fail. DROP COLUMN
        // needs SQLite ≥ 3.35. The title UPDATE retires the "DRAFT — " prefix convention the
        // flag now covers; its WHERE makes it idempotent on its own.
        // One transaction: "Locked exists" is the only idempotency check, so a backfill that
        // committed without its DROP would be re-run against stale values on a later start.
        if (ColumnExists(db, "Blurbs", "Locked"))
        {
            using var tx = db.Database.BeginTransaction();
            db.Database.ExecuteSqlRaw("UPDATE \"Blurbs\" SET \"Draft\" = CASE WHEN \"Locked\" = 1 THEN 0 ELSE 1 END");
            db.Database.ExecuteSqlRaw("ALTER TABLE \"Blurbs\" DROP COLUMN \"Locked\"");
            db.Database.ExecuteSqlRaw("UPDATE \"Blurbs\" SET \"Title\" = substr(\"Title\", 9) WHERE \"Title\" LIKE 'DRAFT — %'");
            tx.Commit();
        }
    }

    // PRAGMA arguments can't be parameterized; table/column only ever come from the literals above.
    private static bool ColumnExists(AppDbContext db, string table, string column)
    {
#pragma warning disable EF1002
        return db.Database
            .SqlQueryRaw<int>($"SELECT COUNT(*) AS Value FROM pragma_table_info('{table}') WHERE name = '{column}'")
            .AsEnumerable().First() > 0;
#pragma warning restore EF1002
    }
}
