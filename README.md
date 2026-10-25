# Unitoolify

[![CI](https://github.com/nkcube/unitoolify/actions/workflows/ci.yml/badge.svg)](https://github.com/nkcube/unitoolify/actions/workflows/ci.yml)

🌐 **Website:** [https://www.unitoolify.com](https://www.unitoolify.com)

Browser-based developer utilities. Every tool runs client-side — input is never
uploaded, and a page you have already loaded keeps working without a network
connection.

## Tools

| Tool                                                                 | What it does                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [Base64 Encode](https://www.unitoolify.com/base64encode/)            | Text or files to Base64, with URL-safe and MIME 76-character options.          |
| [Base64 Decode](https://www.unitoolify.com/base64decode/)            | Base64 back to text, or download the decoded bytes. Handles Base64URL.         |
| [URL Encode](https://www.unitoolify.com/url-encode-string/)          | Component, RFC 3986 strict, full-URL and form-body percent-encoding.           |
| [URL Decode](https://www.unitoolify.com/url-decode-string/)          | Percent-decoding that survives malformed escapes; `+` as space optional.       |
| [HTML Encode](https://www.unitoolify.com/html-encode-string/)        | Escape for text or attribute context, or convert all non-ASCII to entities.    |
| [HTML Decode](https://www.unitoolify.com/html-decode-string/)        | Named and numeric entities back to raw text.                                   |
| [JSON Formatter](https://www.unitoolify.com/prettify-json/)          | Validate and pretty-print with 2/4 space or tab indent, errors with line/col.  |
| [YAML Formatter](https://www.unitoolify.com/prettify-yaml/)          | Re-indent YAML and report syntax errors with a position.                       |
| [JSON to YAML](https://www.unitoolify.com/convert-json-to-yaml/)     | JSON to YAML without folding long values.                                      |
| [YAML to JSON](https://www.unitoolify.com/convert-yaml-to-json/)     | YAML to strict JSON; multi-document files become an array; dates stay strings. |
| [Composerize](https://www.unitoolify.com/composerize/)               | `docker run` to a Compose service.                                             |
| [Decomposerize](https://www.unitoolify.com/decomposerize/)           | Compose file back to `docker run` commands.                                    |
| [UUID Generator](https://www.unitoolify.com/uuid-generator/)         | v4 and v1 UUIDs in bulk, up to 10,000. v1 uses a random node, not your MAC.    |
| [Bookmark Separator](https://www.unitoolify.com/bookmark-separator/) | Vertical or horizontal separators for the Chrome/Edge bookmarks bar.           |

## Architecture

The pages you see are **generated**. Edit files in `src/`, then rebuild.

```
src/
  data/tools.json      # tool registry: titles, descriptions, FAQ, related links
  data/home.json       # home page copy and FAQ
  layouts/base.njk     # document shell: head, metadata, JSON-LD, scripts
  partials/            # header, breadcrumbs, FAQ, related tools, footer
  pages/<slug>/        # per-tool UI fragment + prose
  styles/app.css       # Tailwind source, component classes
  site.mjs             # site constants and the accent palette (WCAG-checked)
scripts/
  build.mjs            # renders every page in place, writes sitemap.xml
  build-vendor.mjs     # bundles composerize, decomposerize, js-yaml locally
  build-css (npm)      # compiles Tailwind to assets/css/app.css
  build-icons.mjs      # OG images, app icons, mask icon
  serve.mjs            # local preview on :4173
assets/
  css/app.css          # build output (committed)
  js/*.js              # hand-written page scripts + shared app.js
  vendor/*.js          # build output (committed)
tests/                 # Playwright: behaviour, metadata, axe, link integrity
```

Output is written to the repository root (`/base64encode/index.html`, …) so the
site keeps deploying as plain static files. No build step is required on the
host.

Each tool names its colour in `tools.json` (`"accent": "violet"`). Hues come
from a hand-picked palette in `src/site.mjs`, so no two tools share one and no
tool straddles the yellow band that reads as "warning" on a dark page. The build
picks the lightness that keeps the primary button at **≥ 4.5:1** and throws if a
palette entry cannot reach it.

## Commands

```bash
npm ci
npm run build:all     # vendor + pages + css + icons
npm run serve         # http://localhost:4173
npm test              # Playwright: 28 behaviour/a11y/SEO tests
npm run lint:html
npm run lint:format
npm run lint:spell
```

After changing anything in `src/` or `assets/js/`, run `npm run build:all` and
commit the generated output — CI fails if the committed build is stale.

## Testing

`tests/tools.spec.mjs` covers the behaviour that has bitten before: 300 KB
Base64 payloads, tab indentation producing a real tab, YAML dates staying
strings, multi-document YAML, tolerant URL decoding, 10,000 UUIDs, clipboard
confirmation, and the Docker converters.

`tests/quality.spec.mjs` asserts, for every page: no console errors, one `h1`,
metadata within length limits, an OG image, **zero third-party requests**, a
JavaScript budget for simple tool pages, a labelled primary action whose button
colours measure **≥ 4.5:1**, no serious axe violations, sitemap coverage and
working internal links.

## Deployment

Vercel serves the repository root as static files. `vercel.json` adds:

- apex → `www` redirect in one hop, `trailingSlash`, `/index.html` → `/`
- a `301` from the retired `/bookmark-separator/horz.html` to the merged page
- security headers (CSP, `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  HSTS, `X-Frame-Options`)
- long-lived caching for `/assets/css/*` and `/assets/img/*`

Analytics is consent-gated: Google Analytics is only requested after the visitor
accepts, and the choice is stored in `localStorage` under `ut-consent`.

## License

&copy; 2026 Unitoolify. All rights reserved.
