namespace CvForge.Api.Models;

/// <summary>A reusable label (language, skill, client, vulnerability class, …) shared across blurbs and work-log entries.</summary>
public class Tag
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Kind { get; set; } = "general"; // language | skill | client | vuln-class | general

    public List<Blurb> Blurbs { get; set; } = new();
}
