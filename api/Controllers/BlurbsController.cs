using CvForge.Api.Data;
using CvForge.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CvForge.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BlurbsController : ControllerBase
{
    private readonly AppDbContext _db;
    public BlurbsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IEnumerable<BlurbDto>> Get(
        [FromQuery] string? category, [FromQuery] string? tag, [FromQuery] string? q,
        [FromQuery] string? group, [FromQuery] bool includeArchived = false)
    {
        var query = _db.Blurbs.Include(b => b.Tags).AsQueryable();
        if (!includeArchived) query = query.Where(b => !b.Archived);
        if (!string.IsNullOrWhiteSpace(category)) query = query.Where(b => b.Category == category);
        if (!string.IsNullOrWhiteSpace(group)) query = query.Where(b => b.SkillGroup == group);
        if (!string.IsNullOrWhiteSpace(tag)) query = query.Where(b => b.Tags.Any(t => t.Name == tag));
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(b => b.Title.Contains(q) || b.Body.Contains(q));

        // SkillGroup is null for every non-skill category, so they all share one bucket and keep
        // their strongest-first ordering; atomic skills additionally cluster by rendered line.
        var list = await query
            .OrderBy(b => b.SkillGroup ?? "")
            .ThenByDescending(b => b.Strength).ThenBy(b => b.Title).ToListAsync();
        return list.Select(BlurbDto.From);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<BlurbDto>> GetOne(int id)
    {
        var b = await _db.Blurbs.Include(x => x.Tags).FirstOrDefaultAsync(x => x.Id == id);
        return b is null ? NotFound() : BlurbDto.From(b);
    }

    [HttpPost]
    public async Task<ActionResult<BlurbDto>> Create(BlurbInput input)
    {
        var b = new Blurb();
        ApplyInput(b, input);
        b.Tags = await ResolveTags(input.Tags);
        _db.Blurbs.Add(b);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetOne), new { id = b.Id }, BlurbDto.From(b));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<BlurbDto>> Update(int id, BlurbInput input)
    {
        var b = await _db.Blurbs.Include(x => x.Tags).FirstOrDefaultAsync(x => x.Id == id);
        if (b is null) return NotFound();
        ApplyInput(b, input);
        b.Tags = await ResolveTags(input.Tags);
        await _db.SaveChangesAsync();
        return BlurbDto.From(b);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var b = await _db.Blurbs.FindAsync(id);
        if (b is null) return NotFound();
        _db.Blurbs.Remove(b);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Copy input onto the entity.</summary>
    private void ApplyInput(Blurb b, BlurbInput input)
    {
        b.Title = input.Title;
        b.Category = input.Category;
        b.Body = input.Body;
        b.Org = input.Org;
        b.Location = input.Location;
        b.RoleTitle = input.RoleTitle;
        b.Dates = input.Dates;
        b.SkillGroup = string.IsNullOrWhiteSpace(input.SkillGroup) ? null : input.SkillGroup.Trim();
        b.Archived = input.Archived;
        b.Strength = Math.Clamp(input.Strength, 0, 5);
        b.PublicSafe = input.PublicSafe;
        b.Draft = input.Draft;
    }

    private async Task<List<Tag>> ResolveTags(List<string>? names)
    {
        var result = new List<Tag>();
        foreach (var name in (names ?? new()).Select(n => n.Trim()).Where(n => n.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var tag = await _db.Tags.FirstOrDefaultAsync(t => t.Name == name)
                      ?? new Tag { Name = name };
            result.Add(tag);
        }
        return result;
    }
}
