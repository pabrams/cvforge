# CVForge

A for creating CVs from a library of reusable blurbs/snippets. Exports to Typst.

## Stack

| Layer | Tech |
|-------|------|
| Backend | **ASP.NET Core 8 Web API**, C#, **EF Core** (SQLite), **Swagger / OpenAPI** |
| Client | **Angular** (standalone components, HttpClient) |

## Features

- **Blurb library** — reusable CV snippets with category (summary / experience / project / skill / qualification / education), Markdown-ish body, many-to-many **tags**, and a self-rated strength. Search + filter. `summary` is the short, human-readable opener — one paragraph of prose, not a keyword block. A `skill` is a *single* skill in plain text (`PostgreSQL`, `C#`) carrying a `skillGroup`; the exporter buckets the selected ones into one `*Databases:* a · b · c` line per group and owns the bold and the Typst escaping. Superseded blurbs are flagged `archived` and hidden from the library, so CVs that already reference them keep exporting unchanged.
- **CV builder** — a CV is a named, ordered selection of blurbs. Multi-select, reorder, remove.
- **Typst export** — renders the selected blurbs into a `.typ` that imports the portfolio's shared `template.typ`.

## Privacy model

The code is public; **your data is not.** Real blurbs live in a local SQLite file (`api/cvforge.db`) that is gitignored. A fresh clone seeds only generic, public-safe **sample** data (`Data/SeedData.cs`). Never commit real work-log notes, prompts, or credentials.

## Running locally

Requires **.NET 8 SDK** and **Node 20+**.

```bash
# 1) API  → http://localhost:5170  (Swagger at /swagger)
cd api
ASPNETCORE_URLS=http://localhost:5170 dotnet run --no-launch-profile

# 2) Angular client → http://localhost:4200
cd angular-client && npm install && npm start
```

The API allows CORS from `localhost:4200`.

## Layout

```
cvforge/
├── api/              ASP.NET Core Web API (C# / EF Core / SQLite / Swagger)
│   ├── Models/       Blurb, Tag, Cv, CvItem
│   ├── Data/         AppDbContext, SeedData
│   ├── Services/     TypstExporter
│   └── Controllers/  Blurbs, Tags, Cvs
└── angular-client/   Angular SPA
```

## Roadmap

- **Work Log module** — capture annotation/eval tasks (structured fields + form Q&A) as the evidence feed; "convert a log entry → a draft blurb."
- Auth + a private deployment for real data.
- Drag-and-drop reordering; live in-app Typst preview.
