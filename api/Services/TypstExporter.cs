using System.Text;
using System.Text.RegularExpressions;
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
        var projects = blurbs.Where(b => b.Category == "project").ToList();
        var education = blurbs.Where(b => b.Category == "education").ToList();
        var skills = blurbs.Where(b => b.Category == "skill").ToList();
        var qualifications = blurbs.Where(b => b.Category == "qualification").ToList();

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

        // template.typ joins these with " · " under a "Certifications & Awards" heading.
        if (qualifications.Count > 0)
        {
            sb.AppendLine("  certifications: (");
            foreach (var b in qualifications)
                sb.AppendLine($"    [{b.Body.Trim()}],");
            sb.AppendLine("  ),");
        }

        sb.AppendLine(")");

        if (skills.Count > 0)
        {
            AppendHeading(sb, "Technical Skills");
            foreach (var line in RenderSkillLines(skills))
                sb.AppendLine($"{line}\n");
        }

        if (projects.Count > 0)
        {
            AppendHeading(sb, "Projects & Open Source");
            foreach (var b in projects)
            {
                var name = string.IsNullOrWhiteSpace(b.Org) ? b.Title : b.Org!;
                sb.AppendLine($"*{name}* — {b.Body.Trim()}\n");
            }
        }

        return sb.ToString();
    }

    private static void AppendHeading(StringBuilder sb, string title)
    {
        sb.AppendLine();
        sb.AppendLine("#v(0.3em)");
        sb.AppendLine($"#text(size: 13pt, weight: \"bold\", fill: rgb(\"#1f4e79\"), \"{title}\")");
        sb.AppendLine("#line(length: 100%, stroke: 0.4pt + rgb(\"#1f4e79\"))");
        sb.AppendLine("#v(0.2em)");
    }

    /// <summary>
    /// Atomic skills carry a plain-text body and a SkillGroup; they are bucketed into one
    /// "*Databases:* a · b · c" line per group, in order of the group's first appearance in the
    /// CV — so reordering items in the builder reorders the rendered lines. Strength 5 renders
    /// bold, which is how emphasis survives without markup in the body.
    ///
    /// A skill with no SkillGroup predates atomization: its body already contains its own
    /// "*Label:* …" prefix and its own escaping, so it is emitted verbatim on its own line and
    /// never merged into a bucket.
    /// </summary>
    private static IEnumerable<string> RenderSkillLines(IEnumerable<Blurb> skills)
    {
        var order = new List<string>();
        var buckets = new Dictionary<string, List<string>>();
        var legacy = new List<(int At, string Body)>();

        foreach (var b in skills)
        {
            var body = b.Body.Trim();
            if (body.Length == 0) continue;

            if (string.IsNullOrWhiteSpace(b.SkillGroup))
            {
                legacy.Add((order.Count, body));
                continue;
            }

            var group = b.SkillGroup!.Trim();
            if (!buckets.TryGetValue(group, out var items))
            {
                buckets[group] = items = new List<string>();
                order.Add(group);
            }

            var item = Escape(body);
            items.Add(b.Strength >= 5 ? $"*{item}*" : item);
        }

        // Legacy lines are interleaved at the point they appeared, so a CV mixing grouped and
        // pre-atomization skills keeps the order the builder shows.
        for (var i = 0; i <= order.Count; i++)
        {
            foreach (var (_, body) in legacy.Where(l => l.At == i))
                yield return body;
            if (i < order.Count)
                yield return $"*{Escape(order[i])}:* {string.Join(" · ", buckets[order[i]])}";
        }
    }

    /// <summary>
    /// Escape Typst markup characters in text that is meant to be literal. Only applied to
    /// plain-text fields (atomic skill names and their group labels) — bodies that deliberately
    /// carry "*bold*" markup, like experience bullets, must pass through untouched.
    /// "#" opens a code expression and "~" is a non-breaking space that vanishes when bare, so
    /// "C#" and "SELECT … FOR UPDATE ~ 50x" both need escaping to survive.
    /// </summary>
    private static string Escape(string s)
    {
        var sb = new StringBuilder(s.Length);
        foreach (var c in s)
        {
            if (c is '#' or '~' or '*' or '_' or '$' or '@' or '\\' or '<' or '>' or '`') sb.Append('\\');
            sb.Append(c);
        }
        return sb.ToString();
    }

    /// <summary>
    /// A leading "-", "•", or "* " is a list marker and is dropped. A leading "*" that is NOT
    /// followed by whitespace opens Typst bold markup — stripping it would invert every emphasis
    /// span in the bullet and leave an unclosed delimiter, so it must be preserved.
    /// </summary>
    private static readonly Regex ListMarker = new(@"^(?:[-•]|\*(?=\s))\s*", RegexOptions.Compiled);

    private static IEnumerable<string> SplitBullets(string body) =>
        body.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(l => ListMarker.Replace(l, ""))
            .Where(l => l.Length > 0);

    /// <summary>Quote a string as a Typst string literal.</summary>
    private static string Str(string s) => "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
}
