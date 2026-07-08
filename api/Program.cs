using CvForge.Api.Data;
using CvForge.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// SQLite database. The file lives outside source control (see .gitignore) so real
// private data never gets committed; a fresh clone seeds sample data instead.
var conn = builder.Configuration.GetConnectionString("Default") ?? "Data Source=cvforge.db";
builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlite(conn));

builder.Services.AddSingleton<SecretScanner>();
builder.Services.AddSingleton<TypstExporter>();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Allow the Angular (4200) and Vue (5173) dev servers to call the API.
const string DevCors = "dev-clients";
builder.Services.AddCors(o => o.AddPolicy(DevCors, p => p
    .WithOrigins("http://localhost:4200", "http://localhost:5173")
    .AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
    SeedData.Ensure(scope.ServiceProvider.GetRequiredService<AppDbContext>());

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors(DevCors);
app.MapControllers();

app.Run();
