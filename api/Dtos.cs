using CvForge.Api.Models;

namespace CvForge.Api;

public record TagDto(int Id, string Name, string Kind);

public record BlurbDto(
    int Id, string Title, string Category, string Body,
    string? Org, string? Location, string? RoleTitle, string? Dates,
    string? SkillGroup, bool Archived,
    int Strength, bool PublicSafe, bool Draft, List<TagDto> Tags)
{
    public static BlurbDto From(Blurb b) => new(
        b.Id, b.Title, b.Category, b.Body, b.Org, b.Location, b.RoleTitle, b.Dates,
        b.SkillGroup, b.Archived,
        b.Strength, b.PublicSafe, b.Draft,
        b.Tags.Select(t => new TagDto(t.Id, t.Name, t.Kind)).ToList());
}

public record BlurbInput(
    string Title, string Category, string Body,
    string? Org, string? Location, string? RoleTitle, string? Dates,
    string? SkillGroup, bool Archived,
    int Strength, bool PublicSafe, bool Draft, List<string>? Tags);

public record CvItemDto(int Id, int BlurbId, int Order, string Title, string Category, string? SkillGroup);
public record CvDto(int Id, string Name, string Tagline, string RoleNotes, List<CvItemDto> Items);
public record CvInput(string Name, string Tagline, string RoleNotes);
public record CvItemsInput(List<int> BlurbIds);   // ordered list of blurb ids
