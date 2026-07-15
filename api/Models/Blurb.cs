namespace CvForge.Api.Models;

/// <summary>
/// A reusable, perfected CV snippet. Write it once, tag it, and compose it into any number of CVs.
/// </summary>
public class Blurb
{
    public int Id { get; set; }

    /// <summary>Short internal title, e.g. "ESDC — cloud microservices".</summary>
    public string Title { get; set; } = "";

    /// <summary>summary | experience | skill | qualification | education</summary>
    public string Category { get; set; } = "experience";

    /// <summary>The prose that lands in the CV (Markdown / Typst-ish inline markup).</summary>
    public string Body { get; set; } = "";

    // Optional structured fields used when Category == "experience".
    public string? Org { get; set; }
    public string? Location { get; set; }
    public string? RoleTitle { get; set; }
    public string? Dates { get; set; }

    /// <summary>0–5 self-rated confidence; helps decide what to lead with.</summary>
    public int Strength { get; set; } = 3;

    /// <summary>Set true only once confirmed free of secrets / confidential content.</summary>
    public bool PublicSafe { get; set; }

    /// <summary>
    /// True = polished/final wording. An assembling agent must reproduce the body verbatim and
    /// never reword it; it may only select and order the blurb. False = a draft that may still be edited.
    /// </summary>
    public bool Locked { get; set; }

    public List<Tag> Tags { get; set; } = new();
}
