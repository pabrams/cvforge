using CvForge.Api.Models;
using CvForge.Api.Services;

namespace CvForge.Api;

public record TagDto(int Id, string Name, string Kind);

public record BlurbDto(
    int Id, string Title, string Category, string Body,
    string? Org, string? Location, string? RoleTitle, string? Dates,
    int Strength, bool PublicSafe, bool Locked, List<TagDto> Tags,
    IReadOnlyList<SecretFinding> Secrets)
{
    public static BlurbDto From(Blurb b, SecretScanner scanner) => new(
        b.Id, b.Title, b.Category, b.Body, b.Org, b.Location, b.RoleTitle, b.Dates,
        b.Strength, b.PublicSafe, b.Locked,
        b.Tags.Select(t => new TagDto(t.Id, t.Name, t.Kind)).ToList(),
        scanner.Scan(b.Body));
}

public record BlurbInput(
    string Title, string Category, string Body,
    string? Org, string? Location, string? RoleTitle, string? Dates,
    int Strength, bool PublicSafe, bool Locked, List<string>? Tags);

public record CvItemDto(int Id, int BlurbId, int Order, string Title, string Category);
public record CvDto(int Id, string Name, string Tagline, string RoleNotes, List<CvItemDto> Items);
public record CvInput(string Name, string Tagline, string RoleNotes);
public record CvItemsInput(List<int> BlurbIds);   // ordered list of blurb ids

public record ScanRequest(string Text);
public record ScanResult(IReadOnlyList<SecretFinding> Findings, string Redacted, bool Clean);
