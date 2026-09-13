namespace CvForge.Api.Models;

/// <summary>
/// A reusable, perfected CV snippet. Write it once, tag it, and compose it into any number of CVs.
/// </summary>
public class Blurb
{
    public int Id { get; set; }

    /// <summary>Short internal title, e.g. "ESDC — cloud microservices".</summary>
    public string Title { get; set; } = "";

    /// <summary>summary | experience | project | skill | qualification | education</summary>
    public string Category { get; set; } = "experience";

    /// <summary>The prose that lands in the CV (Markdown / Typst-ish inline markup).</summary>
    public string Body { get; set; } = "";

    // Optional structured fields used when Category == "experience".
    public string? Org { get; set; }
    public string? Location { get; set; }
    public string? RoleTitle { get; set; }
    public string? Dates { get; set; }

    /// <summary>
    /// Which rendered line an atomic skill belongs to, e.g. "Databases", "Cloud", "Languages".
    /// Only meaningful when Category == "skill": the exporter buckets selected skills by this
    /// value and joins each bucket into one "*Databases:* a · b · c" line. A skill with no
    /// group is a legacy pre-atomization blurb whose body already carries its own label, and
    /// is emitted verbatim on its own line.
    /// </summary>
    public string? SkillGroup { get; set; }

    /// <summary>
    /// Superseded content kept only so CVs that already reference it keep exporting unchanged.
    /// Hidden from the library by default; never offered as new material.
    /// </summary>
    public bool Archived { get; set; }

    /// <summary>0–5 self-rated confidence; helps decide what to lead with.</summary>
    public int Strength { get; set; } = 3;

    /// <summary>Set true only once confirmed free of secrets / confidential content.</summary>
    public bool PublicSafe { get; set; }

    /// <summary>
    /// Provenance, not permission: true = AI-authored wording the user hasn't reviewed yet.
    /// False = the user's own wording — an assembling agent must reproduce the body verbatim,
    /// never reword it; it may only select and order the blurb. The MCP tools always save
    /// true; the web UI clears it on save (a human just edited it, so it's their wording).
    /// </summary>
    public bool Draft { get; set; }

    public List<Tag> Tags { get; set; } = new();
}
