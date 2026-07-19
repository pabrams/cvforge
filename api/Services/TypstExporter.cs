using System.Text;
using CvForge.Api.Models;

namespace CvForge.Api.Services;

/// <summary>
/// Renders a CV (ordered blurbs) into a Typst document that imports the portfolio's shared
/// template.typ — so the output drops straight into the existing build_docx.py pipeline.
/// </summary>
public class TypstExporter
{
    public string Export(Cv cv, IEnumerable<Blurb> orderedBlurbs)
    {
        var blurbs = orderedBlurbs.ToList();

        string summary = string.Join(" ",
            blurbs.Where(b => b.Category == "summary").Select(b => b.Body.Trim()));

        var experience = blurbs.Where(b => b.Category == "experience").ToList();
        var education = blurbs.Where(b => b.Category == "education").ToList();
        var skills = blurbs.Where(b => b.Category is "skill" or "qualification").ToList();
        var competencies = blurbs.Where(b => b.Category == "competencies").ToList();

        var sb = new StringBuilder();
        sb.AppendLine("#import \"template.typ\": cv");
        sb.AppendLine();
        sb.AppendLine("#show: cv.with(");
        sb.AppendLine($"  location: \"Toronto, Ontario\",");
        sb.AppendLine($"  tagline: {Str(cv.Tagline)},");
        sb.AppendLine("  contact: (");
        sb.AppendLine("    \"(819) 921-7192\",");
        sb.AppendLine("    link(\"mailto:j.paul.abrams@protonmail.com\")[j.paul.abrams\\@protonmail.com],");
        sb.AppendLine("    link(\"https://github.com/pabrams\")[github.com/pabrams],");
        sb.AppendLine("    link(\"https://paulabrams.ca\")[paulabrams.ca],");
        sb.AppendLine("  ),");

        if (!string.IsNullOrWhiteSpace(summary))
            sb.AppendLine($"  summary: [{summary}],");

        sb.AppendLine("  experience: (");
        foreach (var b in experience)
        {
            sb.AppendLine("    (");
            sb.AppendLine($"      org: {Str(b.Org ?? b.Title)},");
            sb.AppendLine($"      location: {Str(b.Location ?? "")},");
            sb.AppendLine($"      dates: {Str(b.Dates ?? "")},");
            sb.AppendLine($"      title: {Str(b.RoleTitle ?? b.Title)},");
            sb.AppendLine("      bullets: (");
            foreach (var line in SplitBullets(b.Body))
                sb.AppendLine($"        [{line}],");
            sb.AppendLine("      ),");
            sb.AppendLine("    ),");
        }
        sb.AppendLine("  ),");

        if (education.Count > 0)
        {
            sb.AppendLine("  education: (");
            foreach (var b in education)
                sb.AppendLine($"    (degree: {Str(b.RoleTitle ?? b.Title)}, school: {Str(b.Org ?? "")}, dates: {Str(b.Dates ?? "")}),");
            sb.AppendLine("  ),");
        }

        sb.AppendLine(")");

        if (skills.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("#v(0.3em)");
            sb.AppendLine("#text(size: 13pt, weight: \"bold\", fill: rgb(\"#1f4e79\"), \"Technical Skills\")");
            sb.AppendLine("#line(length: 100%, stroke: 0.4pt + rgb(\"#1f4e79\"))");
            sb.AppendLine("#v(0.2em)");
            foreach (var b in skills)
                sb.AppendLine($"{b.Body.Trim()}\n");
        }

        // Dense, keyword-rich profile aimed at ATS parsers rather than human readers —
        // rendered at the bottom so the human-readable summary stays the first thing seen.
        if (competencies.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("#v(0.3em)");
            sb.AppendLine("#text(size: 13pt, weight: \"bold\", fill: rgb(\"#1f4e79\"), \"Core Competencies\")");
            sb.AppendLine("#line(length: 100%, stroke: 0.4pt + rgb(\"#1f4e79\"))");
            sb.AppendLine("#v(0.2em)");
            foreach (var b in competencies)
                sb.AppendLine($"{b.Body.Trim()}\n");
        }

        return sb.ToString();
    }

    private static IEnumerable<string> SplitBullets(string body) =>
        body.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(l => l.TrimStart('-', '*', ' '))
            .Where(l => l.Length > 0);

    /// <summary>Quote a string as a Typst string literal.</summary>
    private static string Str(string s) => "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
}
