using CvForge.Api.Models;

namespace CvForge.Api.Data;

/// <summary>
/// Seeds a small set of SAMPLE blurbs so a fresh clone / public demo is usable.
/// This is deliberately generic, public-safe content — real private work-log data lives
/// only in the gitignored local database, never here.
/// </summary>
public static class SeedData
{
    public static void Ensure(AppDbContext db)
    {
        db.Database.EnsureCreated();
        SchemaPatch.Apply(db);
        if (db.Blurbs.Any()) return;

        Tag T(string name, string kind) =>
            db.Tags.Local.FirstOrDefault(t => t.Name == name)
            ?? db.Tags.FirstOrDefault(t => t.Name == name)
            ?? new Tag { Name = name, Kind = kind };

        var csharp = T("C#", "language");
        var dotnet = T(".NET", "skill");
        var azure = T("Azure", "skill");
        var sql = T("SQL", "skill");
        var angular = T("Angular", "skill");
        var vue = T("Vue", "skill");
        var ops = T("OPS", "client");

        var blurbs = new List<Blurb>
        {
            new()
            {
                Title = "Senior full-stack summary",
                Category = "summary",
                Body = "Senior full-stack developer with 15+ years across the full SDLC, shipping web-based enterprise applications from front-end UI through service back ends and relational databases.",
                Strength = 5, PublicSafe = true, Locked = true,
                Tags = new() { csharp, dotnet, azure },
            },
            new()
            {
                Title = "ESDC — cloud microservices",
                Category = "experience",
                Org = "Employment and Social Development, Canada",
                Location = "Gatineau, QC", Dates = "December 2021 – July 2025",
                RoleTitle = "Senior Software Developer — Cloud-Native Microservices",
                Body = "Enhanced and maintained a cloud-native microservices onboarding application (.NET Core / C#, Blazor, Azure SQL, Azure Functions).\nDesigned and consumed REST APIs between services, documented with Swagger and governed through Azure API Management.\nMigrated downstream identity to Azure Managed Identities, eliminating the secret-rotation incident class.",
                Strength = 5, PublicSafe = true, Locked = true,
                Tags = new() { csharp, dotnet, azure, sql },
            },
            new()
            {
                Title = "DOJ — iCase legal case management",
                Category = "experience",
                Org = "Department of Justice, Canada",
                Location = "Ottawa, ON", Dates = "October 2008 – April 2014",
                RoleTitle = "Full-Stack Developer — Legal Case Management System (iCase)",
                Body = "Core developer on a distributed, multi-tier ASP.NET / C# enterprise platform used by 5,000+ government lawyers nationally.\nOptimized a high-traffic backend report for a ~50x speedup via execution-plan analysis.\nMigrated core business modules from VB.NET to C#.",
                Strength = 4, PublicSafe = true, Locked = true,
                Tags = new() { csharp, dotnet, sql },
            },
            new()
            {
                Title = "Front-end frameworks skill line",
                Category = "skill",
                Body = "*Front-End:* JavaScript, TypeScript, HTML / CSS, React, Angular, Vue, Blazor, Knockout.js — responsive, WCAG AA / AODA accessible.",
                Strength = 3, PublicSafe = true, Locked = true,
                Tags = new() { angular, vue },
            },
            new()
            {
                Title = "[SAMPLE] raw note with a leaked key",
                Category = "experience",
                Body = "Set up the calibration harness — exported EXAMPLE_API_KEY=PLACEHOLDER_not_a_real_secret and ran the tool. (This sample blurb shows the secret scanner blocking export until redacted. The value here is a deliberately fake placeholder.)",
                Strength = 1, PublicSafe = false,
                Tags = new() { ops },
            },
        };

        db.Blurbs.AddRange(blurbs);
        db.SaveChanges();
    }
}
