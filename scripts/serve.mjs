import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 4173);

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

  if (!pathname.endsWith("/") && !path.extname(pathname)) {
    res.writeHead(308, { location: pathname + "/" });
    res.end();
    return;
  }

  let file = path.join(ROOT, pathname);
  if (pathname.endsWith("/")) file = path.join(file, "index.html");
  if (!path.resolve(file).startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }

  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const notFound = path.join(ROOT, "404.html");
    res.writeHead(404, { "content-type": MIME[".html"] });
    res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : "Not found");
    return;
  }

  res.writeHead(200, {
    "content-type": MIME[path.extname(file)] || "application/octet-stream",
    "cache-control": "no-store",
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
