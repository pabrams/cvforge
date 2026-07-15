#!/usr/bin/env node
// CVForge MCP server — exposes the blurb library + CV builder to an MCP client
// (e.g. Claude Code) over stdio. It is a thin wrapper over the CVForge REST API,
// so all business logic (secret scanning, Typst export) lives in one place.
//
// Guardrails baked in here (not just in prompting):
//   • create_blurb / update_blurb always produce DRAFTS (locked = false). The AI
//     never mints a "polished" blurb — only a human does, in the app.
//   • update_blurb REFUSES to touch a locked blurb. Locked = verbatim; the AI may
//     select and order it, never reword it.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API = (process.env.CVFORGE_API_BASE || "http://localhost:5170/api").replace(/\/$/, "");

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

const ok = (obj) => ({ content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }] });
const err = (msg) => ({ content: [{ type: "text", text: msg }], isError: true });

const server = new McpServer({ name: "cvforge", version: "1.0.0" });

server.registerTool("list_tags",
  { title: "List tags", description: "List all tags (languages, skills, clients, …) used across the blurb library." },
  async () => {
    const r = await api("/tags");
    return r.ok ? ok(r.data) : err(`API ${r.status}`);
  });

server.registerTool("search_blurbs",
  {
    title: "Search blurbs",
    description: "Search the reusable blurb library. Returns each blurb's body, category, tags, strength, and — importantly — its `locked` flag. A locked blurb is polished: reproduce its body VERBATIM, never reword it.",
    inputSchema: {
      q: z.string().optional().describe("free-text match on title/body"),
      category: z.string().optional().describe("summary | experience | skill | qualification | education"),
      tag: z.string().optional().describe("exact tag name, e.g. 'Angular'"),
    },
  },
  async ({ q, category, tag }) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (category) qs.set("category", category);
    if (tag) qs.set("tag", tag);
    const r = await api(`/blurbs?${qs}`);
    return r.ok ? ok(r.data) : err(`API ${r.status}`);
  });

server.registerTool("get_blurb",
  { title: "Get blurb", description: "Fetch one blurb by id.", inputSchema: { id: z.number().int() } },
  async ({ id }) => {
    const r = await api(`/blurbs/${id}`);
    return r.ok ? ok(r.data) : err(`Blurb ${id} not found (API ${r.status})`);
  });

const blurbFields = {
  title: z.string(),
  category: z.enum(["summary", "experience", "skill", "qualification", "education"]),
  body: z.string(),
  org: z.string().optional(),
  roleTitle: z.string().optional(),
  dates: z.string().optional(),
  location: z.string().optional(),
  tags: z.array(z.string()).optional(),
  strength: z.number().int().min(0).max(5).optional(),
};

server.registerTool("create_blurb",
  {
    title: "Create a draft blurb",
    description: "Create a NEW blurb. It is always saved as an unpolished DRAFT (locked = false, not public-safe) for the user to review and polish. Use this only when no existing blurb covers a required point — never to paraphrase a locked blurb.",
    inputSchema: blurbFields,
  },
  async (a) => {
    const r = await api("/blurbs", {
      method: "POST",
      body: {
        title: a.title, category: a.category, body: a.body,
        org: a.org, roleTitle: a.roleTitle, dates: a.dates, location: a.location,
        tags: a.tags ?? [], strength: a.strength ?? 3,
        publicSafe: false, locked: false, // AI output is always an unpolished draft
      },
    });
    return r.ok ? ok(r.data) : err(`API ${r.status}: ${JSON.stringify(r.data)}`);
  });

server.registerTool("update_blurb",
  {
    title: "Update a draft blurb",
    description: "Edit an existing DRAFT blurb (merges provided fields). REFUSES to modify a locked blurb — locked wording is the user's and must be used verbatim. Any edit stays a draft.",
    inputSchema: { id: z.number().int(), ...Object.fromEntries(Object.entries(blurbFields).map(([k, v]) => [k, v.optional()])) },
  },
  async ({ id, ...patch }) => {
    const cur = await api(`/blurbs/${id}`);
    if (!cur.ok) return err(`Blurb ${id} not found (API ${cur.status})`);
    const b = cur.data;
    if (b.locked) return err(`Blurb ${id} ("${b.title}") is LOCKED — polished wording that must be used verbatim. The AI may not edit it. Ask the user to unlock it in the app if a change is genuinely needed.`);
    const merged = {
      title: patch.title ?? b.title,
      category: patch.category ?? b.category,
      body: patch.body ?? b.body,
      org: patch.org ?? b.org,
      roleTitle: patch.roleTitle ?? b.roleTitle,
      dates: patch.dates ?? b.dates,
      location: patch.location ?? b.location,
      tags: patch.tags ?? b.tags.map((t) => t.name),
      strength: patch.strength ?? b.strength,
      publicSafe: false, locked: false, // edited blurb remains an unpolished draft
    };
    const r = await api(`/blurbs/${id}`, { method: "PUT", body: merged });
    return r.ok ? ok(r.data) : err(`API ${r.status}: ${JSON.stringify(r.data)}`);
  });

server.registerTool("list_cvs",
  { title: "List CVs", description: "List saved CVs (each is an ordered selection of blurbs)." },
  async () => {
    const r = await api("/cvs");
    return r.ok ? ok(r.data) : err(`API ${r.status}`);
  });

server.registerTool("create_cv",
  {
    title: "Create a CV",
    description: "Create a new, empty CV targeted at a posting. Add blurbs afterward with set_cv_items.",
    inputSchema: { name: z.string(), tagline: z.string().optional() },
  },
  async ({ name, tagline }) => {
    const r = await api("/cvs", { method: "POST", body: { name, tagline: tagline ?? "", roleNotes: "" } });
    return r.ok ? ok(r.data) : err(`API ${r.status}`);
  });

server.registerTool("set_cv_items",
  {
    title: "Set CV blurbs (ordered)",
    description: "Replace a CV's blurb selection with an ordered list of blurb ids. Order matters — it's the order they appear in the CV.",
    inputSchema: { cvId: z.number().int(), blurbIds: z.array(z.number().int()) },
  },
  async ({ cvId, blurbIds }) => {
    const r = await api(`/cvs/${cvId}/items`, { method: "PUT", body: { blurbIds } });
    return r.ok ? ok(r.data) : err(`API ${r.status}: ${JSON.stringify(r.data)}`);
  });

server.registerTool("export_typst",
  {
    title: "Export CV to Typst",
    description: "Render a CV to a Typst document (imports the portfolio's template.typ → feeds build_docx.py). Blocked if any selected blurb still contains a detected secret.",
    inputSchema: { cvId: z.number().int() },
  },
  async ({ cvId }) => {
    const r = await api(`/cvs/${cvId}/export.typ`);
    if (r.status === 409) return err(`Export blocked — a selected blurb contains an unredacted secret: ${JSON.stringify(r.data)}`);
    return r.ok ? ok(typeof r.data === "string" ? r.data : JSON.stringify(r.data)) : err(`API ${r.status}`);
  });

server.registerTool("scan_secrets",
  {
    title: "Scan text for secrets",
    description: "Check arbitrary text for likely credentials before storing it. Returns findings and a redacted version.",
    inputSchema: { text: z.string() },
  },
  async ({ text }) => {
    const r = await api("/scan", { method: "POST", body: { text } });
    return r.ok ? ok(r.data) : err(`API ${r.status}`);
  });

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`cvforge-mcp connected (API base: ${API})`);
