export const SITE = {
  name: "Unitoolify",
  domain: "https://www.unitoolify.com",
  tagline:
    "Developer tools that run right in your browser. No sign-ups, no uploads.",
  description:
    "Free online developer tools that run 100% in your browser: Base64, JSON and YAML formatters, UUID generator, URL and HTML encoders, Docker compose converters.",
  gaId: "G-2FWD7FC8GL",
  ogImage: "/assets/img/og-default.png",
  twitterCard: "summary_large_image",
};

/**
 * Hues are hand-picked rather than derived from a slug hash, so that no two
 * tools share a hue (a hash hands 14 tools a birthday-collision), no tool lands
 * on the sickly yellow-green band, and assignments stay stable when tools are
 * added or renamed. Each tool names its own entry in src/data/tools.json.
 *
 * The gap between 38 (amber) and 143 (green) is deliberate: everything in
 * between reads as "yellow" on a dark background and loses identity.
 */
export const PALETTE = {
  indigo: 243,
  violet: 262,
  purple: 283,
  // Magenta only clears 4.5:1 against white below ~48% lightness, so it carries
  // its own target instead of the default 54%.
  fuchsia: { h: 305, l: 46 },
  pink: 328,
  rose: 348,
  red: 6,
  orange: 22,
  amber: 38,
  green: 143,
  teal: 170,
  cyan: 191,
  sky: 205,
  blue: 222,
};

/** Saturation is capped below "pure" so accents sit in the page instead of shouting. */
const SATURATION = 0.66;

function hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

const channel = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

function luminance([r, g, b]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const WHITE = [255, 255, 255];
const INK = [15, 23, 42];

/**
 * Accent colour for a palette entry, guaranteed to keep text legible.
 * Walks the lightness range and keeps the value nearest the designed 54% that
 * still reaches WCAG AA (4.5:1) against either white or ink, then reports which
 * foreground that lightness requires. Throws instead of shipping an unreadable
 * accent, so a bad palette edit fails the build rather than the audit.
 */
export function accent(name) {
  const entry = PALETTE[name];
  if (entry === undefined) {
    throw new Error(
      `Unknown accent "${name}" — add it to PALETTE in src/site.mjs`,
    );
  }
  const { h, l: target = 54 } =
    typeof entry === "number" ? { h: entry } : entry;

  let best = null;
  for (let l = 32; l <= 70; l += 2) {
    const rgb = hslToRgb(h, SATURATION, l / 100);
    const [cw, ci] = [contrast(rgb, WHITE), contrast(rgb, INK)];
    // White is the default button label; ink only takes over on the lighter
    // hues (amber, green, cyan) where white would not reach 4.5:1.
    const candidate = {
      l,
      c: Math.max(cw, ci),
      onPrimary: cw >= 4.5 ? "#ffffff" : "#0f172a",
    };
    if (
      candidate.c >= 4.5 &&
      (!best || Math.abs(l - target) < Math.abs(best.l - target))
    ) {
      best = candidate;
    }
  }

  if (!best) {
    throw new Error(
      `Accent "${name}" (hue ${h}) cannot reach 4.5:1 at any lightness — pick another hue`,
    );
  }

  const { l, onPrimary, c } = best;
  const stop = (dl, ds, dh) =>
    `hsl(${(h + dh) % 360} ${Math.round(SATURATION * 100 + ds)}% ${Math.round(l + dl)}%)`;

  return {
    primary: stop(0, 0, 0),
    hover: `hsl(${h} ${SATURATION * 100}% ${Math.max(26, l - 7)}%)`,
    // Kept inside the same hue family (±22°) so the heading still reads as *this*
    // tool's colour rather than drifting into a neighbour's.
    gradient: `linear-gradient(to right, ${stop(14, 12, 0)}, ${stop(-6, 12, 22)})`,
    onPrimary,
    contrast: Math.round(c * 100) / 100,
  };
}
