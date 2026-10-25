import crypto from "node:crypto";
import fs from "node:fs";
import sharp from "sharp";
import { accent } from "../src/site.mjs";

const data = JSON.parse(fs.readFileSync("src/data/tools.json", "utf8"));
const { tools, categories } = data;

fs.mkdirSync("assets/img/og", { recursive: true });

/*
 * Rendering text is not byte-stable across platforms: the same SVG draws
 * with different hinting on macOS and on Linux CI, so an unconditional redraw
 * makes every checkout dirty and the drift check meaningless. Each image is
 * therefore keyed on a hash of its own SVG (plus size) and only redrawn when
 * that source actually changes. `npm run build:icons -- --force` overrides.
 */
const MANIFEST = "assets/img/icons.manifest.json";
const force = process.argv.includes("--force");
let previous = {};
try {
  previous = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
} catch {
  /* first run */
}
const next = {};

const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";

function wrap(text, max) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function ogSvg({ title, kicker, accent: accentName }) {
  const a = accent(accentName);
  const lines = wrap(title, 22).slice(0, 3);
  const startY = 300 - (lines.length - 1) * 44;
  const titleSvg = lines
    .map(
      (line, i) =>
        `<text x="80" y="${startY + i * 88}" font-family="${FONT}" font-size="76" font-weight="700" fill="#f8fafc" letter-spacing="-1">${esc(line)}</text>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${a.primary}"/>
      <stop offset="100%" stop-color="${a.hover}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="10" fill="url(#accent)"/>
  <circle cx="1080" cy="120" r="180" fill="${a.primary}" opacity="0.10"/>
  <text x="80" y="120" font-family="${FONT}" font-size="30" font-weight="700" fill="#94a3b8" letter-spacing="4">UNITOOLIFY</text>
  <text x="80" y="176" font-family="${FONT}" font-size="26" fill="#64748b">${esc(kicker)}</text>
  ${titleSvg}
  <text x="80" y="560" font-family="${FONT}" font-size="26" fill="#94a3b8">Runs in your browser · Free · No uploads</text>
  <text x="1120" y="560" text-anchor="end" font-family="${FONT}" font-size="26" fill="#475569">unitoolify.com</text>
</svg>`;
}

async function png(svg, file, width, height) {
  const key = crypto
    .createHash("sha256")
    .update(`${width}x${height}\n${svg}`)
    .digest("hex")
    .slice(0, 16);
  next[file] = key;

  if (!force && previous[file] === key && fs.existsSync(file)) {
    return fs.statSync(file).size;
  }

  await sharp(Buffer.from(svg))
    .resize(width, height)
    .png({ compressionLevel: 9, palette: true })
    .toFile(file);
  return fs.statSync(file).size;
}

let total = 0;
total += await png(
  ogSvg({
    title: "Free developer tools for the browser",
    kicker: `${tools.length} utilities`,
    accent: "indigo",
  }),
  "assets/img/og-default.png",
  1200,
  630,
);

for (const tool of tools) {
  const category = categories.find((c) => c.id === tool.category);
  const file = `assets/img/og/${tool.slug}.png`;
  total += await png(
    ogSvg({ title: tool.h1, kicker: category.name, accent: tool.accent }),
    file,
    1200,
    630,
  );
}

/* ---- app icons ---- */
const iconSvg = (padding = 0) => {
  const size = 100;
  const inner = size - padding * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#a78bfa"/>
  </linearGradient></defs>
  <rect width="100" height="100" fill="#0f172a"/>
  <rect x="${padding}" y="${padding}" width="${inner}" height="${inner}" rx="${inner * 0.22}" fill="url(#g)"/>
  <text x="50" y="50" font-family="${FONT}" font-size="${inner * 0.62}" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">UT</text>
</svg>`;
};

await png(iconSvg(0), "assets/img/apple-touch-icon.png", 180, 180);
await png(iconSvg(0), "assets/img/icon-192.png", 192, 192);
await png(iconSvg(0), "assets/img/icon-512.png", 512, 512);
await png(iconSvg(14), "assets/img/icon-maskable-512.png", 512, 512);

fs.writeFileSync(
  "assets/img/mask-icon.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#000"/><text x="50" y="50" font-family="${FONT}" font-size="62" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">UT</text></svg>\n`,
);

console.log(
  `icons written · OG average ${(total / (tools.length + 1) / 1024).toFixed(1)} KB`,
);

const imageCount = Object.keys(next).length;
const rendered = Object.entries(next).filter(
  ([file, key]) => force || previous[file] !== key || !fs.existsSync(file),
).length;

if (rendered || JSON.stringify(previous) !== JSON.stringify(next)) {
  fs.writeFileSync(MANIFEST, `${JSON.stringify(next, null, 2)}\n`);
}
console.log(
  `${imageCount} images · ${rendered} rendered · ${imageCount - rendered} unchanged`,
);
