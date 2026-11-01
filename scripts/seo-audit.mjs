#!/usr/bin/env node
/**
 * Read-only indexability audit of the published site.
 *
 * The point is to separate two questions that get confused constantly:
 *
 *   1. Can a crawler read and understand the page?  -> measured here.
 *   2. Does the search engine choose to store and rank it? -> only Search
 *      Console knows, because that decision depends on links and trust.
 *
 * This script answers question 1 exhaustively and prints a verdict per URL.
 * If everything is green here, on-page work is no longer the bottleneck and
 * the problem is authority, not markup.
 *
 * Usage:
 *   node scripts/seo-audit.mjs
 *   node scripts/seo-audit.mjs --base http://localhost:3000
 *   node scripts/seo-audit.mjs --json out.json
 *
 * Exit code is 1 when a hard indexability failure is found, so this can be
 * wired into CI later without surprises.
 */

const args = process.argv.slice(2);

function flag(name, fallback) {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : (args[at + 1] ?? fallback);
}

const BASE = flag("base", "https://www.unitoolify.com").replace(/\/$/, "");
const JSON_OUT = flag("json", null);
const UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const HARD = [];
const SOFT = [];

function hard(msg) {
  HARD.push(msg);
}
function soft(msg) {
  SOFT.push(msg);
}

async function fetch_ok(url, method = "GET") {
  const started = Date.now();
  const res = await fetch(url, {
    method,
    headers: { "user-agent": UA, accept: "*/*" },
    redirect: "follow",
  });
  const body = method === "GET" ? await res.text() : "";
  return { res, body, ms: Date.now() - started };
}

function text_of(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function one(html, re) {
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function all(html, re) {
  return [...html.matchAll(re)].map((m) => m[1].trim());
}

function count_json_ld(html) {
  const blocks = all(html, /<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  const types = [];
  let broken = 0;
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block);
      const nodes = Array.isArray(parsed)
        ? parsed
        : parsed["@graph"] || [parsed];
      for (const node of nodes) types.push(node["@type"] ?? "?");
    } catch {
      broken += 1;
    }
  }
  return { blocks: blocks.length, types, broken };
}

async function audit_page(url) {
  const row = { url };
  let got;
  try {
    got = await fetch_ok(url);
  } catch (err) {
    hard(`${url} — fetch failed: ${err.message}`);
    return { ...row, status: 0 };
  }

  const { res, body, ms } = got;
  row.status = res.status;
  row.ms = ms;
  row.final = res.url;
  row.bytes = Buffer.byteLength(body);

  if (res.status !== 200) {
    hard(`${url} — HTTP ${res.status}`);
  }
  if (res.url.replace(/\/$/, "") !== url.replace(/\/$/, "")) {
    soft(`${url} — redirected to ${res.url}`);
  }

  const robots = one(
    body,
    /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)/i,
  );
  row.robots = robots ?? "(none)";
  if (robots && /noindex|none/i.test(robots))
    hard(`${url} — meta robots ${robots}`);

  const canonical = one(
    body,
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i,
  );
  row.canonical = canonical;
  if (!canonical) hard(`${url} — no canonical`);
  else if (canonical.replace(/\/$/, "") !== url.replace(/\/$/, "")) {
    soft(`${url} — canonical points elsewhere: ${canonical}`);
  }

  const xrobots = res.headers.get("x-robots-tag");
  if (xrobots) soft(`${url} — X-Robots-Tag: ${xrobots}`);

  row.title = one(body, /<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!row.title) hard(`${url} — no <title>`);

  row.description = one(
    body,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i,
  );
  if (!row.description) soft(`${url} — no meta description`);

  const h1s = all(body, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map(text_of);
  row.h1 = h1s.length;
  if (h1s.length !== 1) soft(`${url} — ${h1s.length} h1 elements`);

  row.words = text_of(body).split(" ").filter(Boolean).length;
  if (row.words < 300) soft(`${url} — thin: ${row.words} words`);

  const ld = count_json_ld(body);
  row.jsonld = ld.blocks;
  row.types = [...new Set(ld.types)];
  if (ld.broken) soft(`${url} — ${ld.broken} invalid JSON-LD block(s)`);
  if (!ld.blocks) soft(`${url} — no JSON-LD`);

  row.internal = new Set(
    all(body, /href=["'](\/[^"'#?]*)/gi).filter((h) => h.startsWith("/")),
  ).size;

  const og = one(body, /property=["']og:image["'][^>]+content=["']([^"']+)/i);
  row.og = Boolean(og);
  if (og) {
    try {
      const head = await fetch_ok(og, "HEAD");
      if (head.res.status !== 200) soft(`${url} — og:image ${head.res.status}`);
    } catch {
      soft(`${url} — og:image unreachable`);
    }
  } else {
    soft(`${url} — no og:image`);
  }

  return row;
}

function pad(value, width) {
  const s = String(value ?? "");
  return s.length > width ? `${s.slice(0, width - 1)} ` : s.padEnd(width);
}

async function main() {
  console.log(`\nIndexability audit -> ${BASE}\n`);

  // Site level ---------------------------------------------------------
  const robots_url = `${BASE}/robots.txt`;
  let robots_txt = "";
  try {
    const got = await fetch_ok(robots_url);
    robots_txt = got.body;
    const declares_sitemap = /^\s*sitemap:/im.test(robots_txt);
    const blocks_all = /^\s*disallow:\s*\/\s*$/im.test(robots_txt);
    console.log(
      `robots.txt   ${got.res.status}  sitemap:${
        declares_sitemap ? "yes" : "NO"
      }  blocks-all:${blocks_all ? "YES" : "no"}`,
    );
    if (got.res.status !== 200) hard("robots.txt is not 200");
    if (!declares_sitemap) soft("robots.txt does not declare a sitemap");
  } catch (err) {
    hard(`robots.txt unreachable: ${err.message}`);
  }

  const sitemap_url = `${BASE}/sitemap.xml`;
  let locs = [];
  try {
    const got = await fetch_ok(sitemap_url);
    locs = [...got.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) =>
      m[1].trim(),
    );
    console.log(`sitemap.xml  ${got.res.status}  urls:${locs.length}`);
    if (got.res.status !== 200) hard("sitemap.xml is not 200");
    if (!locs.length) hard("sitemap.xml lists no URLs");
  } catch (err) {
    hard(`sitemap.xml unreachable: ${err.message}`);
  }

  // Apex to www, so link equity is not split -------------------------
  const apex = BASE.replace("www.", "");
  if (apex !== BASE) {
    try {
      const res = await fetch(apex, { headers: { "user-agent": UA } });
      const final = new URL(res.url).hostname;
      const ok = final === new URL(BASE).hostname;
      console.log(`${apex} -> ${final} ${ok ? "" : "(links split!)"}`);
      if (!ok) soft(`${apex} does not redirect to ${BASE}`);
    } catch {
      soft(`${apex} unreachable`);
    }
  }

  // Pages --------------------------------------------------------------
  // The sitemap always lists absolute production URLs, so --base has to be
  // applied to the locs as well; otherwise a local run silently audits the
  // live site and reports numbers that have nothing to do with the build
  // sitting on disk.
  const origin = new URL(BASE).origin;
  const rows = [];
  for (const loc of locs) {
    const target = loc.replace(/^https?:\/\/[^/]+/, origin);
    rows.push(await audit_page(target));
  }

  // A field repeated across pages is a wasted slot, not a style choice.
  for (const [i, row] of rows.entries()) {
    for (const other of rows.slice(i + 1)) {
      if (row.title && other.title && row.title === other.title) {
        soft(`duplicate <title>: ${row.url} == ${other.url}`);
      }
      if (
        row.description &&
        other.description &&
        row.description === other.description
      ) {
        soft(`duplicate description: ${row.url} == ${other.url}`);
      }
    }
  }

  console.log("\n--- per page ---");
  console.log(
    pad("status", 7) +
      pad("ms", 6) +
      pad("words", 7) +
      pad("links", 7) +
      pad("ld", 4) +
      pad("title", 7) +
      pad("desc", 6) +
      "url",
  );
  for (const row of rows) {
    const tl = row.title ? row.title.length : 0;
    const dl = row.description ? row.description.length : 0;
    console.log(
      pad(row.status, 7) +
        pad(row.ms, 6) +
        pad(row.words, 7) +
        pad(row.internal, 7) +
        pad(row.jsonld, 4) +
        pad(`${tl}`, 7) +
        pad(`${dl}`, 6) +
        (row.url.replace(BASE, "") || "/"),
    );
    if (tl > 65) soft(`${row.url} — title ${tl} chars, likely truncated`);
    if (dl && (dl < 70 || dl > 165))
      soft(`${row.url} — description ${dl} chars`);
  }

  const schema_types = [...new Set(rows.flatMap((r) => r.types ?? []))].sort();
  const avg_words = Math.round(
    rows.reduce((sum, r) => sum + (r.words || 0), 0) / Math.max(rows.length, 1),
  );
  console.log(`\npages:${rows.length}  avg words:${avg_words}`);
  console.log(`schema types: ${schema_types.join(", ") || "none"}`);

  // The one thing a crawler cannot tell you ------------------------
  console.log("\n--- not measurable here ---");
  console.log("  indexed page count  -> Search Console > Pages");
  console.log("  impressions/clicks  -> Search Console > Performance");
  console.log("  average position    -> Search Console > Performance");
  console.log("  referring domains   -> any backlink tool; this needs votes,");
  console.log("                         and votes are the actual bottleneck.");

  if (SOFT.length) {
    console.log(`\n--- warnings (${SOFT.length}) ---`);
    for (const msg of SOFT) console.log(`  ! ${msg}`);
  }
  if (HARD.length) {
    console.log(`\n--- hard failures (${HARD.length}) ---`);
    for (const msg of HARD) console.log(`  x ${msg}`);
  }

  const verdict = HARD.length
    ? "NOT indexable — fix the failures above first"
    : "Technically indexable. Remaining cause of no traffic is authority, not markup.";
  console.log(`\nverdict: ${verdict}\n`);

  if (JSON_OUT) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(JSON_OUT, `${JSON.stringify(rows, null, 2)}\n`);
    console.log(`json written to ${JSON_OUT}`);
  }

  process.exitCode = HARD.length ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 2;
});
