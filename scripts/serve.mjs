import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 4173);

// The preview server replays vercel.json, so a too-tight CSP or a bad redirect
// fails here instead of in production.
const config = JSON.parse(
  fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"),
);

function matches(source, pathname) {
  if (source === "/(.*)") return true;
  const idx = source.indexOf("(.*)");
  if (idx === -1) return source === pathname;
  const head = source.slice(0, idx);
  const tail = source.slice(idx + 3);
  return pathname.startsWith(head) && pathname.endsWith(tail);
}

function headersFor(pathname) {
  const out = {};
  for (const rule of config.headers || []) {
    if (!matches(rule.source, pathname)) continue;
    for (const { key, value } of rule.headers) out[key] = value;
  }
  return out;
}

function redirectFor(pathname) {
  for (const rule of config.redirects || []) {
    // Host-based redirects (apex → www) do not apply to localhost.
    if (rule.has) continue;
    if (rule.source === pathname) return rule.destination;
  }
  return null;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  let pathname = decodeURIComponent(url.pathname);
  const security = headersFor(pathname);

  const redirect = redirectFor(pathname);
  if (redirect) {
    res.writeHead(301, { ...security, location: redirect });
    res.end();
    return;
  }

  if (!pathname.endsWith("/") && !path.extname(pathname)) {
    res.writeHead(308, { ...security, location: pathname + "/" });
    res.end();
    return;
  }

  let file = path.join(ROOT, pathname);
  if (pathname.endsWith("/")) file = path.join(file, "index.html");
  if (!path.resolve(file).startsWith(ROOT)) {
    res.writeHead(403, security).end();
    return;
  }

  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const notFound = path.join(ROOT, "404.html");
    res.writeHead(404, { ...security, "content-type": MIME[".html"] });
    res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : "Not found");
    return;
  }

  res.writeHead(200, {
    ...security,
    "content-type": MIME[path.extname(file)] || "application/octet-stream",
    "cache-control": "no-store",
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
