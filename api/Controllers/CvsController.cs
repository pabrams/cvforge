using System.Text;
using CvForge.Api.Data;
using CvForge.Api.Models;
using CvForge.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CvForge.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CvsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TypstExporter _exporter;
    private readonly SecretScanner _scanner;
    public CvsController(AppDbContext db, TypstExporter exporter, SecretScanner scanner)
        => (_db, _exporter, _scanner) = (db, exporter, scanner);

    [HttpGet]
    public async Task<IEnumerable<CvDto>> Get() =>
        (await _db.Cvs.Include(c => c.Items).ThenInclude(i => i.Blurb).ToListAsync())
            .Select(ToDto);

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CvDto>> GetOne(int id)
    {
        var cv = await Load(id);
        return cv is null ? NotFound() : ToDto(cv);
    }

    [HttpPost]
    public async Task<ActionResult<CvDto>> Create(CvInput input)
    {
        var cv = new Cv { Name = input.Name, Tagline = input.Tagline, RoleNotes = input.RoleNotes };
        _db.Cvs.Add(cv);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetOne), new { id = cv.Id }, ToDto(cv));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<CvDto>> Update(int id, CvInput input)
    {
        var cv = await Load(id);
        if (cv is null) return NotFound();
        cv.Name = input.Name; cv.Tagline = input.Tagline; cv.RoleNotes = input.RoleNotes;
        await _db.SaveChangesAsync();
        return ToDto(cv);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var cv = await _db.Cvs.FindAsync(id);
        if (cv is null) return NotFound();
        _db.Cvs.Remove(cv);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Replace the CV's blurb selection with an ordered list of blurb ids.</summary>
    [HttpPut("{id:int}/items")]
    public async Task<ActionResult<CvDto>> SetItems(int id, CvItemsInput input)
    {
        var cv = await Load(id);
        if (cv is null) return NotFound();

        _db.CvItems.RemoveRange(cv.Items);
        cv.Items = input.BlurbIds
            .Select((blurbId, i) => new CvItem { CvId = id, BlurbId = blurbId, Order = i })
            .ToList();
        await _db.SaveChangesAsync();

        return ToDto((await Load(id))!);
    }

    /// <summary>Render the CV to Typst (imports template.typ → feeds build_docx.py).</summary>
    [HttpGet("{id:int}/export.typ")]
    public async Task<IActionResult> ExportTypst(int id)
    {
        var cv = await Load(id);
        if (cv is null) return NotFound();

        var ordered = cv.Items.OrderBy(i => i.Order).Select(i => i.Blurb!).ToList();

        // Guard: never let a detected secret leak into a generated document.
        var leaky = ordered.Where(b => _scanner.HasSecrets(b.Body)).Select(b => b.Title).ToList();
        if (leaky.Count > 0)
            return Conflict(new { message = "Blurbs contain unredacted secrets; fix before export.", blurbs = leaky });

        var typ = _exporter.Export(cv, ordered);
        return File(Encoding.UTF8.GetBytes(typ), "text/plain", $"cv-{Slug(cv.Name)}.typ");
    }

    private Task<Cv?> Load(int id) =>
        _db.Cvs.Include(c => c.Items).ThenInclude(i => i.Blurb).ThenInclude(b => b!.Tags)
            .FirstOrDefaultAsync(c => c.Id == id);

    private static CvDto ToDto(Cv cv) => new(
        cv.Id, cv.Name, cv.Tagline, cv.RoleNotes,
        cv.Items.OrderBy(i => i.Order)
            .Select(i => new CvItemDto(i.Id, i.BlurbId, i.Order, i.Blurb?.Title ?? "", i.Blurb?.Category ?? "", i.Blurb?.SkillGroup))
            .ToList());

    private static string Slug(string s) =>
        new string(s.ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray())
            .Trim('-');
}
