using CvForge.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CvForge.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Blurb> Blurbs => Set<Blurb>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<Cv> Cvs => Set<Cv>();
    public DbSet<CvItem> CvItems => Set<CvItem>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        // Blurb <-> Tag many-to-many via an implicit join table.
        b.Entity<Blurb>()
            .HasMany(x => x.Tags)
            .WithMany(x => x.Blurbs)
            .UsingEntity(j => j.ToTable("BlurbTags"));

        b.Entity<Tag>().HasIndex(t => t.Name).IsUnique();

        // Deleting a CV removes its items; deleting a blurb removes references to it.
        b.Entity<CvItem>()
            .HasOne(i => i.Cv).WithMany(c => c.Items)
            .HasForeignKey(i => i.CvId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<CvItem>()
            .HasOne(i => i.Blurb).WithMany()
            .HasForeignKey(i => i.BlurbId).OnDelete(DeleteBehavior.Cascade);
    }
}
