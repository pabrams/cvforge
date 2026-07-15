// Smoke test: spawn the MCP server over stdio, list tools, and exercise the
// key flows (search → build CV → export) plus the locked-blurb guardrail.
// Requires the CVForge API running on http://localhost:5170.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({ command: "node", args: ["server.js"] });
const client = new Client({ name: "cvforge-test", version: "1.0.0" });
await client.connect(transport);

const text = (r) => r.content.map((c) => c.text).join("\n");
const call = (name, args) => client.callTool({ name, arguments: args ?? {} });

const { tools } = await client.listTools();
console.log("TOOLS:", tools.map((t) => t.name).join(", "));

const blurbs = JSON.parse(text(await call("search_blurbs", { category: "experience" })));
console.log(`\nsearch_blurbs(experience): ${blurbs.length} found`);
const locked = blurbs.find((b) => b.locked);
console.log(`  locked example: "${locked.title}" (id ${locked.id})`);

// Guardrail: AI must not edit a locked blurb.
const editLocked = await call("update_blurb", { id: locked.id, body: "REWORDED BY AI" });
console.log(`\nupdate_blurb on locked → isError=${editLocked.isError}`);
console.log("  " + text(editLocked).slice(0, 90) + "…");

// Build a CV from locked blurbs and export.
const cv = JSON.parse(text(await call("create_cv", { name: "MCP Test CV", tagline: "test" })));
console.log(`\ncreate_cv → id ${cv.id}`);
await call("set_cv_items", { cvId: cv.id, blurbIds: blurbs.map((b) => b.id) });
const typ = text(await call("export_typst", { cvId: cv.id }));
console.log(`export_typst → ${typ.split("\n").length} lines, starts: ${typ.slice(0, 34)}…`);

// Draft creation stays unpolished.
const draft = JSON.parse(text(await call("create_blurb", { title: "AI draft", category: "skill", body: "Some drafted skill line." })));
console.log(`\ncreate_blurb → id ${draft.id}, locked=${draft.locked}, publicSafe=${draft.publicSafe} (both should be false)`);

// Cleanup the test CV + draft.
await fetch(`http://localhost:5170/api/cvs/${cv.id}`, { method: "DELETE" });
await fetch(`http://localhost:5170/api/blurbs/${draft.id}`, { method: "DELETE" });

await client.close();
console.log("\n✓ MCP server verified end-to-end");
