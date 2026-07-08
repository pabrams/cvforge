namespace CvForge.Api.Models;

/// <summary>A named, ordered selection of blurbs targeted at one posting.</summary>
public class Cv
{
    public int Id { get; set; }
    public string Name { get; set; } = "";          // e.g. "RQ11319 — SCOPE Senior Dev"
    public string Tagline { get; set; } = "";
    public string RoleNotes { get; set; } = "";     // free notes about the target posting

    public List<CvItem> Items { get; set; } = new();
}

/// <summary>One blurb placed at a position within a CV.</summary>
public class CvItem
{
    public int Id { get; set; }
    public int CvId { get; set; }
    public Cv? Cv { get; set; }

    public int BlurbId { get; set; }
    public Blurb? Blurb { get; set; }

    public int Order { get; set; }
}
