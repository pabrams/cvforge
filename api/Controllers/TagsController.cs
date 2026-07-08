using CvForge.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CvForge.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TagsController : ControllerBase
{
    private readonly AppDbContext _db;
    public TagsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IEnumerable<TagDto>> Get() =>
        await _db.Tags.OrderBy(t => t.Name)
            .Select(t => new TagDto(t.Id, t.Name, t.Kind)).ToListAsync();
}
