# CVForge — working notes for Claude

CVForge is a blurb library + CV builder. You assemble tailored CVs from reusable, pre-written
**blurbs** by selecting and ordering them — you are **not** a ghostwriter.

## How to reach the data

The `cvforge` MCP server (configured in `.mcp.json`) exposes the blurb library and CV builder as
tools: `search_blurbs`, `get_blurb`, `create_blurb`, `update_blurb`, `list_cvs`, `create_cv`,
`set_cv_items`, `export_typst`, `scan_secrets`, `list_tags`.

**The API must be running** for those tools to work:

```bash
cd api && ASPNETCORE_URLS=http://localhost:5170 dotnet run --no-launch-profile
```

`--no-launch-profile` is required: without it, `launchSettings.json` overrides `ASPNETCORE_URLS`
and the API binds to port 5041 instead, so the MCP tools (which expect 5170) can't connect.

If a tool returns a connection error, the API isn't up — tell the user to start it.

The API has no homepage — `http://localhost:5170/` is a 404 by design. Swagger is at `/swagger`,
data under `/api/...`. The web UI is a separate SPA: `cd vue-client && npm run dev`
(http://localhost:5173) or `cd angular-client && npm start` (http://localhost:4200).

## The rules (non-negotiable)

1. **Locked blurbs are verbatim.** A blurb with `locked: true` is the user's polished wording.
   Select and order it; **never reword, summarize, or "improve" it.** (`update_blurb` will refuse
   to edit a locked blurb — that's by design, not an error to work around.)

2. **Draft only for genuine gaps.** If no blurb covers a point the posting requires, use
   `create_blurb` to add an *unpolished draft* (it's saved `locked: false`, not public-safe). Then
   **tell the user exactly which blurbs are drafts they need to polish.** Don't paraphrase an
   existing locked blurb into a "new" one to dodge rule 1.

3. **Never fabricate experience.** Only claim what the blurbs actually evidence. If the posting
   needs something the user doesn't have, say so plainly — don't invent it. Framing genuine
   transferable experience is fine; inventing history is not.

4. **Secrets never leave.** Don't put credentials into blurbs. `export_typst` is blocked if any
   selected blurb contains a detected secret; if that happens, tell the user which blurb to fix.

## Typical flow

Paste a job posting → `search_blurbs` by category/tag to find relevant material → assemble the CV
(summary → experience → skills, strongest first) from **locked** blurbs verbatim → draft only what's
genuinely missing (flagged) → `create_cv` + `set_cv_items` → `export_typst`. Report what you used
and what still needs the user's polish.

See `.claude/skills/cvforge/SKILL.md` for the step-by-step.

## Compiling the export to PDF

`typst` is installed at `~/.local/bin/typst` (on PATH) — **don't re-download it**. Save the
`export_typst` output next to the other CVs in `../pabrams.github.io/cv/` (it imports `template.typ`
from there) and run `typst compile <file>.typ`.

Known issue: `export_typst` output is not Typst-escaped. In markup, escape `C#` → `C\#` and
`~` → `\~` (a bare `~` is a non-breaking space and vanishes); inside quoted strings like `tagline:`,
do **not** escape. For ATS-bound submissions prefer the `.docx` route
(`../pabrams.github.io/cv/build_docx.py` — Typst PDFs embed fonts some parsers can't read).
