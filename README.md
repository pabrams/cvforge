# CVForge

A small full-stack tool for assembling tailored CVs from a library of reusable, tagged **blurbs** — write each experience/skill snippet once, then compose CVs by selecting and ordering blurbs, and export straight to **Typst** (feeds an existing `build_docx.py` → `.docx` / `.pdf` pipeline).

Built as a reference implementation across the stack, with the **same app implemented in both Angular and Vue** against one shared ASP.NET Core Web API.

## Stack

| Layer | Tech |
|-------|------|
| Backend | **ASP.NET Core 8 Web API**, C#, **EF Core** (SQLite), **Swagger / OpenAPI** |
| Client A | **Angular** (standalone components, HttpClient) |
| Client B | **Vue 3** (`<script setup>`, TypeScript, Vite) |

Both clients are feature-for-feature identical and talk to the same REST API.

## Features

- **Blurb library** — reusable CV snippets with category (summary / experience / skill / qualification / education), Markdown-ish body, many-to-many **tags**, and a self-rated strength. Search + filter.
- **CV builder** — a CV is a named, ordered selection of blurbs. Multi-select, reorder, remove.
- **Typst export** — renders the selected blurbs into a `.typ` that imports the portfolio's shared `template.typ`.
- **Secret scanning** — a `SecretScanner` service flags likely credentials (AWS/OpenAI/GitHub/Slack keys, JWTs, private keys, `KEY=…` assignments, plus a Shannon-entropy sweep). Findings show live as you type; a blurb can't be marked *public-safe* while it contains a secret, and **export is blocked (HTTP 409)** if any selected blurb still carries one.

## Privacy model

The code is public; **your data is not.** Real blurbs live in a local SQLite file (`api/cvforge.db`) that is gitignored. A fresh clone seeds only generic, public-safe **sample** data (`Data/SeedData.cs`). Never commit real work-log notes, prompts, or credentials.

## Running locally

Requires **.NET 8 SDK** and **Node 20+**.

```bash
# 1) API  → http://localhost:5170  (Swagger at /swagger)
cd api
ASPNETCORE_URLS=http://localhost:5170 dotnet run

# 2) Angular client → http://localhost:4200
cd angular-client && npm install && npm start

# 3) Vue client → http://localhost:5173
cd vue-client && npm install && npm run dev
```

The API allows CORS from `localhost:4200` and `localhost:5173`.

## Layout

```
cvforge/
├── api/              ASP.NET Core Web API (C# / EF Core / SQLite / Swagger)
│   ├── Models/       Blurb, Tag, Cv, CvItem
│   ├── Data/         AppDbContext, SeedData
│   ├── Services/     SecretScanner, TypstExporter
│   └── Controllers/  Blurbs, Tags, Cvs, Scan
├── angular-client/   Angular SPA
└── vue-client/       Vue 3 + Vite SPA
```

## Roadmap

- **Work Log module** — capture annotation/eval tasks (structured fields + form Q&A) as the evidence feed; "convert a log entry → a draft blurb."
- Auth + a private deployment for real data.
- Drag-and-drop reordering; live in-app Typst preview.
