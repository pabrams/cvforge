---
name: cvforge
description: Assemble a tailored CV from the CVForge blurb library for a specific job posting. Use when the user pastes a posting and wants a CV, or asks to build/tailor a CV. Selects and orders existing blurbs (locked ones verbatim), drafts only genuine gaps, and exports Typst. Requires the CVForge API running and the `cvforge` MCP server.
---

# Assemble a CV from the blurb library

You compose a CV by **selecting and ordering** pre-written blurbs — you are not rewriting them.
The `cvforge` MCP tools are your interface to the library. If they error with a connection failure,
the API isn't running (`cd api && ASPNETCORE_URLS=http://localhost:5170 dotnet run`).

## Steps

1. **Read the posting.** Extract the concrete requirements: mandatory skills, years, technologies,
   domain. Note which are hard requirements vs. nice-to-haves.

2. **Gather candidate blurbs.** Use `search_blurbs` — by `category` (summary / experience / skill /
   qualification / education) and by `tag` (e.g. a required technology). Read each result's `body`,
   `strength`, `tags`, and `locked` flag. Prefer higher `strength`.

3. **Map requirements → blurbs.** For each key requirement, find the blurb(s) that evidence it.
   - A blurb with `locked: true` → use its body **verbatim**. Do not reword it.
   - Track which requirements have **no** covering blurb. Those are gaps.

4. **Handle gaps honestly.**
   - If the user genuinely has the experience but no blurb captures it, `create_blurb` a concise
     **draft** (saved unpolished). Keep it truthful and minimal.
   - If the user does **not** have the experience, do **not** invent it. Note the gap for the user.
     Where legitimate, you may lead with transferable experience — but never fabricate history.

5. **Build the CV.** `create_cv` (name it after the posting, e.g. "RQ11319 — SCOPE Senior"), then
   `set_cv_items` with an ordered list of blurb ids. Sensible order: summary → experience (strongest
   / most relevant first) → skills → qualifications / education.

6. **Export.** `export_typst` to produce the `.typ`. If it's blocked for a secret, tell the user
   which blurb to redact and stop — don't try to route around it.

7. **Report back.** Tell the user:
   - which blurbs you used (and that locked ones are verbatim),
   - **exactly which blurbs are drafts they need to polish**,
   - any posting requirement you couldn't cover, stated plainly.

## Don'ts

- Don't reword, summarize, or "tighten" a locked blurb.
- Don't paraphrase an existing blurb into a new one to avoid the verbatim rule.
- Don't claim experience the blurbs don't support.
- Don't put credentials in blurbs; don't try to bypass a blocked export.
