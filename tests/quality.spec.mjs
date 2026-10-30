import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = [
  "/",
  "/base64encode/",
  "/base64decode/",
  "/prettify-json/",
  "/prettify-yaml/",
  "/convert-json-to-yaml/",
  "/convert-yaml-to-json/",
  "/uuid-generator/",
  "/url-encode-string/",
  "/url-decode-string/",
  "/html-encode-string/",
  "/html-decode-string/",
  "/composerize/",
  "/decomposerize/",
  "/bookmark-separator/",
  "/privacy/",
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ut-consent", "denied"));
  await page.route("https://pagead2.googlesyndication.com/**", (route) => {
    route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
});

const TOOL_PAGES = PAGES.filter((p) => !["/", "/privacy/"].includes(p));

/** WCAG 2.x relative luminance + contrast ratio, mirroring src/site.mjs. */
function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("every tool page has one legible primary action", async ({ page }) => {
  for (const url of TOOL_PAGES) {
    await page.goto(url);
    const data = await page.evaluate(() => {
      const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number).slice(0, 3);
      const btns = [...document.querySelectorAll(".btn-primary")];
      const cs = btns[0] && getComputedStyle(btns[0]);
      return {
        count: btns.length,
        text: btns[0] ? btns[0].textContent.trim().replace(/\s+/g, " ") : "",
        bg: cs ? parse(cs.backgroundColor) : null,
        fg: cs ? parse(cs.color) : null,
      };
    });

    expect(data.count, `${url} has no .btn-primary`).toBeGreaterThan(0);
    expect(
      data.text.length,
      `${url} primary button has no label`,
    ).toBeGreaterThan(0);
    const ratio = contrast(data.bg, data.fg);
    expect(
      ratio,
      `${url} primary button "${data.text}" is ${ratio.toFixed(2)}:1 (${data.bg} on ${data.fg})`,
    ).toBeGreaterThanOrEqual(4.5);
  }
});

test("every page loads without console errors and has core metadata", async ({
  page,
}) => {
  for (const url of PAGES) {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(url, { waitUntil: "load" });

    expect(errors, `console errors on ${url}`).toEqual([]);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /.{80,}/,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /^https:\/\/www\.unitoolify\.com/,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /og/,
    );
    const desc = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(desc.length, `description too long on ${url}`).toBeLessThanOrEqual(
      160,
    );
    page.removeAllListeners();
  }
});

test("no third-party requests on a tool page", async ({ page }) => {
  const external = [];
  page.on("request", (req) => {
    const url = req.url();
    if (
      !url.startsWith("http://127.0.0.1:4173") &&
      !url.startsWith("http://localhost:4173") &&
      !url.startsWith("https://pagead2.googlesyndication.com/")
    ) {
      external.push(url);
    }
  });
  await page.goto("/prettify-json/", { waitUntil: "networkidle" });
  expect(external).toEqual([]);
});

test("tool page JavaScript stays small", async ({ page }) => {
  const jsBytes = [];
  page.on("response", async (res) => {
    if (res.url().endsWith(".js")) {
      try {
        jsBytes.push((await res.body()).length);
      } catch {}
    }
  });
  await page.goto("/prettify-json/", { waitUntil: "networkidle" });
  const total = jsBytes.reduce((a, b) => a + b, 0);
  expect(total, "uncompressed JS on a simple tool page").toBeLessThan(30000);
});

test("accessibility: no serious axe violations on key pages", async ({
  page,
}) => {
  for (const url of [
    "/",
    "/prettify-json/",
    "/bookmark-separator/",
    "/privacy/",
  ]) {
    await page.goto(url);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact),
    );
    expect(
      serious.map((v) => `${url} ${v.id}: ${v.help}`),
      `axe violations on ${url}`,
    ).toEqual([]);
  }
});

test("sitemap lists every indexable page and internal links resolve", async ({
  page,
  request,
}) => {
  const xml = fs.readFileSync(path.join(process.cwd(), "sitemap.xml"), "utf8");
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  expect(locs).toContain("https://www.unitoolify.com/");
  for (const url of PAGES.filter((p) => p !== "/privacy/")) {
    expect(locs, `missing ${url} in sitemap`).toContain(
      `https://www.unitoolify.com${url}`,
    );
  }

  const seen = new Set();
  for (const url of PAGES) {
    await page.goto(url);
    const hrefs = await page.$$eval("a[href^='/']", (els) =>
      els.map((el) => el.getAttribute("href")),
    );
    for (const href of new Set(hrefs)) {
      const clean = href.split("#")[0];
      if (!clean || seen.has(clean)) continue;
      seen.add(clean);
      const res = await request.get(clean);
      expect(res.status(), `broken link ${href} on ${url}`).toBeLessThan(400);
    }
  }
});

test("security headers are served and the CSP blocks nothing the site needs", async ({
  page,
}) => {
  const res = await page.request.get("/prettify-json/");
  const headers = res.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-frame-options"]).toBe("DENY");

  // The preview server replays vercel.json, so these headers are the real ones.
  const violations = [];
  await page.exposeFunction("__cspViolation", (v) => violations.push(v));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__cspViolation?.(
        `${event.violatedDirective} blocked ${event.blockedURI}`,
      );
    });
  });

  for (const url of PAGES) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
  }

  expect(violations).toEqual([]);
});

test("analytics is never requested before the visitor accepts", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.removeItem("ut-consent"));
  const analytics = [];
  page.on("request", (req) => {
    if (req.url().includes("googletagmanager")) analytics.push(req.url());
  });

  await page.goto("/");
  await expect(
    page.getByRole("dialog", { name: "Analytics consent" }),
  ).toBeVisible();
  await page.waitForTimeout(1800); // the banner waits 1.2 s before appearing

  expect(analytics).toEqual([]);
});

test("accepting loads the analytics script once and the choice sticks", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.removeItem("ut-consent"));
  const hits = [];
  // Stubbed, so the suite never touches Google — this checks our own wiring
  // (consent → script injection → persisted choice), not Google's response.
  await page.route("https://www.googletagmanager.com/**", (route) => {
    hits.push(route.request().url());
    route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Accept" }).click();
  await expect.poll(() => hits.length).toBe(1);
  expect(hits[0]).toContain("id=G-");

  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "Analytics consent" }),
  ).toHaveCount(0);
});

test("every page points at a real 1200x630 social image", () => {
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "assets/img/icons.manifest.json"),
      "utf8",
    ),
  );
  const pages = [
    "index.html",
    ...PAGES.slice(1).map((u) => `${u.slice(1)}index.html`),
  ];

  for (const file of pages) {
    // Prettier wraps long attribute lists onto separate lines, so normalise
    // whitespace before matching.
    const html = fs
      .readFileSync(path.join(process.cwd(), file), "utf8")
      .replace(/\s+/g, " ");
    const src = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
    expect(src, `no og:image on ${file}`).toBeTruthy();

    const local = new URL(src).pathname.slice(1);
    expect(
      manifest[local],
      `${local} is not in the icon manifest`,
    ).toBeTruthy();

    const png = fs.readFileSync(path.join(process.cwd(), local));
    expect(png.subarray(1, 4).toString(), `${local} is not a PNG`).toBe("PNG");
    expect(
      [png.readUInt32BE(16), png.readUInt32BE(20)],
      `${local} size`,
    ).toEqual([1200, 630]);
  }
});
