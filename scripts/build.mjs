import fs from "node:fs";
import path from "node:path";
import nunjucks from "nunjucks";
import prettier from "prettier";
import prettierConfig from "../prettier.config.mjs";
import { SITE, accent } from "../src/site.mjs";

const ROOT = process.cwd();
const data = JSON.parse(fs.readFileSync("src/data/tools.json", "utf8"));
const homeData = JSON.parse(fs.readFileSync("src/data/home.json", "utf8"));
const { tools, categories } = data;
const bySlug = Object.fromEntries(tools.map((t) => [t.slug, t]));

const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(path.join(ROOT, "src"), { noCache: true }),
  { autoescape: true, trimBlocks: true, lstripBlocks: true },
);
env.addFilter("abs", (u) => SITE.domain + u);
env.addFilter("ld", (o) => JSON.stringify(o, null, 0).replace(/</g, "\\u003c"));

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8").trim() : "");
const abs = (u) => SITE.domain + u;

const nav = [
  { name: "JSON Formatter", url: "/prettify-json/" },
  { name: "Base64", url: "/base64encode/" },
  { name: "UUID", url: "/uuid-generator/" },
  { name: "All tools", url: "/#tools" },
];

const popular = [
  "base64encode",
  "base64decode",
  "prettify-json",
  "prettify-yaml",
  "uuid-generator",
  "convert-json-to-yaml",
  "composerize",
  "url-encode-string",
].map((s) => ({ label: bySlug[s].name, url: bySlug[s].url }));

const searches = [
  { label: "Base64 encode online", url: "/base64encode/" },
  { label: "UUID v4 generator online", url: "/uuid-generator/" },
  { label: "JSON formatter online", url: "/prettify-json/" },
  { label: "Base64 file decoder online", url: "/base64decode/" },
  { label: "docker run to compose converter", url: "/composerize/" },
];

const year = new Date().getFullYear();
const globalCtx = { site: SITE, nav, popular, searches, categories, year };

// No <lastmod> in the sitemap: any date derived from git or the clock makes the
// committed output stale the instant it is committed, which breaks the CI drift
// check on every deploy. Sitemaps are valid without it, and a stale date is a
// worse signal than none.

const urlToFile = (url) =>
  url === "/" ? "index.html" : path.join(url.replace(/^\//, ""), "index.html");

async function write(file, html) {
  const out = await prettier.format(html, {
    ...prettierConfig,
    parser: "html",
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out);
  return out.length;
}

const faqLd = (faq) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

const crumbsLd = (crumbs) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map((c, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: c.name,
    ...(c.url ? { item: abs(c.url) } : {}),
  })),
});

let written = 0;

for (const tool of tools) {
  const a = accent(tool.accent);
  const category = categories.find((c) => c.id === tool.category);
  const crumbs = [
    { name: "Home", url: "/" },
    { name: category.name, url: `/#${category.id}` },
    { name: tool.name },
  ];
  const relatedTools = tool.related
    .filter((s) => bySlug[s])
    .map((s) => ({
      name: bySlug[s].name,
      url: bySlug[s].url,
    }));
  const ui = read(`src/pages/${tool.slug}/ui.html`);
  const prose = read(`src/pages/${tool.slug}/prose.html`);
  const tail = [
    prose,
    env.render("partials/faq.njk", { page: { faq: tool.faq } }),
    env.render("partials/related.njk", { page: { relatedTools } }),
  ].join("\n");

  const page = {
    ...globalCtx,
    isHome: false,
    pageName: tool.slug,
    tool,
    title: tool.title,
    description: tool.description,
    ogTitle: tool.title.replace(/ \| Unitoolify$/, ""),
    ogDescription: tool.description,
    canonical: abs(tool.url),
    robots: "index, follow",
    h1: tool.h1,
    subtitle: tool.subtitle,
    hero: true,
    accent: a,
    breadcrumbs: crumbs,
    mainClass:
      tool.slug === "bookmark-separator"
        ? "mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pb-8 md:px-8 md:gap-8"
        : "mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 px-4 pb-8 md:grid-cols-2 md:gap-8 md:px-8",
    body: [ui, tail].filter(Boolean).join("\n"),
    script: fs.existsSync(`assets/js/${tool.slug}.js`)
      ? `${tool.slug}.js`
      : null,
    vendor: [
      "prettify-yaml",
      "convert-json-to-yaml",
      "convert-yaml-to-json",
    ].includes(tool.slug)
      ? ["js-yaml"]
      : [],
    ogImage: `/assets/img/og/${tool.slug}.png`,
    jsonld: [
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: tool.h1,
        alternateName: tool.name,
        url: abs(tool.url),
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Any (browser)",
        browserRequirements: "Requires JavaScript",
        description: tool.description,
        isAccessibleForFree: true,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
        featureList: tool.features,
        publisher: {
          "@type": "Organization",
          name: SITE.name,
          url: SITE.domain,
        },
      },
      crumbsLd(crumbs),
      faqLd(tool.faq),
    ].map((o) => JSON.stringify(o)),
  };

  written += await write(
    path.join(ROOT, urlToFile(tool.url)),
    env.render("layouts/base.njk", { ...page, page }),
  );
}

/* ---------- home ---------- */
{
  const grid = categories
    .map((category) => {
      const items = tools.filter((t) => t.category === category.id);
      if (!items.length) return "";
      const cards = items
        .map(
          (t) => `<a href="${t.url}" class="tool-card group">
  <span aria-hidden="true" class="flex items-center justify-center text-2xl leading-none">${t.icon}</span>
  <div class="min-w-0 text-base font-semibold md:text-[17px]">${t.name}</div>
  <p class="col-span-2 mt-2 text-sm leading-relaxed text-slate-400">${t.card}</p>
</a>`,
        )
        .join("\n");
      // Pick the column count that divides the category evenly, so no row is
      // left with a single stranded card and half the page empty. A category
      // holding one tool sits half-width, which lets Generators and Utilities
      // share a row.
      const solo = items.length === 1;
      const span = solo ? "md:col-span-3" : "md:col-span-6";
      const cols = items.length % 3 === 0 ? 3 : items.length % 2 === 0 ? 2 : 3;
      const inner = solo
        ? "grid grid-cols-1 gap-4"
        : `grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-${cols}`;
      // The blurb is centred on the heading's glyph box rather than
      // baseline-aligned: with `flex-wrap` Safari ignores the baseline and
      // falls back to flex-start, which left the sentence floating at the top
      // of the heading. `leading-none` collapses the heading's line box so the
      // two centres land on the same line.
      return `<section id="${category.id}" class="scroll-mt-8 ${span}">
  <div class="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 md:mb-6">
    <h2 class="text-lg leading-none font-bold text-slate-50 md:text-xl">${category.name}</h2>
    <p class="text-sm text-slate-400">${category.blurb}</p>
  </div>
  <div class="${inner}">${cards}</div>
</section>`;
    })
    .join("\n");

  const body = env.renderString(read("src/pages/home.html"), {
    grid,
    tools,
    ...globalCtx,
  });
  const page = {
    ...globalCtx,
    isHome: true,
    pageName: "home",
    title: homeData.title,
    description: homeData.description,
    ogTitle: homeData.ogTitle,
    ogDescription: homeData.ogDescription,
    canonical: abs("/"),
    robots: "index, follow",
    accent: {
      primary: "#3b82f6",
      hover: "#2563eb",
      onPrimary: "#ffffff",
      gradient: "linear-gradient(to right, #60a5fa, #a78bfa, #34d399)",
    },
    breadcrumbs: null,
    hero: false,
    mainClass: "mx-auto w-full max-w-7xl flex-1 px-4 pb-16 md:px-8 md:pb-24",
    body,
    script: null,
    ogImage: SITE.ogImage,
    jsonld: [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE.name,
        url: SITE.domain,
        description: homeData.description,
        inLanguage: "en",
        publisher: {
          "@type": "Organization",
          name: SITE.name,
          url: SITE.domain,
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Free Online Developer Tools",
        itemListElement: tools.map((t, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: t.name,
          url: abs(t.url),
        })),
      },
      faqLd(homeData.faq),
    ].map((o) => JSON.stringify(o)),
  };
  written += await write(
    path.join(ROOT, "index.html"),
    env.render("layouts/base.njk", { ...page, page }),
  );
}

/* ---------- 404 ---------- */
{
  const page = {
    ...globalCtx,
    isHome: false,
    pageName: "404",
    title: "Page not found | Unitoolify",
    description:
      "That page does not exist. Browse the full list of Unitoolify developer tools.",
    ogTitle: "Page not found – Unitoolify",
    ogDescription: "That page does not exist.",
    canonical: abs("/404.html"),
    robots: "noindex, follow",
    accent: {
      primary: "#3b82f6",
      hover: "#2563eb",
      onPrimary: "#ffffff",
      gradient: "linear-gradient(to right, #60a5fa, #a78bfa)",
    },
    breadcrumbs: null,
    hero: false,
    mainClass: "mx-auto w-full max-w-3xl flex-1 px-4 py-16 md:px-8",
    body: env.renderString(read("src/pages/404.html"), { ...globalCtx, tools }),
    script: null,
    ogImage: SITE.ogImage,
    jsonld: [],
  };
  written += await write(
    path.join(ROOT, "404.html"),
    env.render("layouts/base.njk", { ...page, page }),
  );
}

/* ---------- privacy ---------- */
{
  const page = {
    ...globalCtx,
    isHome: false,
    pageName: "privacy",
    title: "Privacy Policy | Unitoolify",
    description:
      "How Unitoolify handles your data: tool input is processed in your browser and never uploaded. Analytics is optional and consent-gated.",
    ogTitle: "Privacy Policy – Unitoolify",
    ogDescription:
      "Tool input never leaves your browser. Analytics is optional.",
    canonical: abs("/privacy/"),
    robots: "index, follow",
    accent: {
      primary: "#3b82f6",
      hover: "#2563eb",
      onPrimary: "#ffffff",
      gradient: "linear-gradient(to right, #60a5fa, #a78bfa)",
    },
    breadcrumbs: [{ name: "Home", url: "/" }, { name: "Privacy" }],
    hero: true,
    h1: "Privacy Policy",
    subtitle: "What stays on your device, and the little that does not.",
    mainClass: "mx-auto w-full max-w-3xl flex-1 px-4 pb-8 md:px-8",
    body: read("src/pages/privacy.html"),
    script: null,
    ogImage: SITE.ogImage,
    jsonld: [crumbsLd([{ name: "Home", url: "/" }, { name: "Privacy" }])].map(
      (o) => JSON.stringify(o),
    ),
  };
  written += await write(
    path.join(ROOT, "privacy/index.html"),
    env.render("layouts/base.njk", { ...page, page }),
  );
}

/* ---------- sitemap ---------- */
{
  const urls = [abs("/"), ...tools.map((t) => abs(t.url)), abs("/privacy/")];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u}</loc>
    <changefreq>${u === abs("/") ? "weekly" : "monthly"}</changefreq>
    <priority>${u === abs("/") ? "1.0" : "0.8"}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml);
}

console.log(
  `built ${tools.length} tool pages + home + 404 + privacy (${(written / 1024).toFixed(1)} KB html)`,
);
