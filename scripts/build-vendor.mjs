import { build } from "esbuild";
import fs from "node:fs";

fs.mkdirSync("assets/vendor", { recursive: true });

const shared = {
  bundle: true,
  minify: true,
  platform: "browser",
  target: ["es2020", "chrome100", "firefox100", "safari15"],
  legalComments: "none",
  logLevel: "warning",
};

// Runtime import from a pinned local bundle instead of esm.sh.
await build({
  ...shared,
  entryPoints: ["node_modules/composerize/dist/composerize.js"],
  format: "esm",
  outfile: "assets/vendor/composerize.js",
});

await build({
  ...shared,
  entryPoints: ["node_modules/decomposerize/dist/decomposerize.js"],
  format: "esm",
  outfile: "assets/vendor/decomposerize.js",
});

// js-yaml as a classic global (window.jsyaml) for the plain scripts.
await build({
  ...shared,
  entryPoints: ["node_modules/js-yaml/index.js"],
  format: "iife",
  globalName: "jsyaml",
  outfile: "assets/vendor/js-yaml.js",
});

for (const file of ["composerize", "decomposerize", "js-yaml"]) {
  const size = fs.statSync(`assets/vendor/${file}.js`).size;
  console.log(`assets/vendor/${file}.js  ${(size / 1024).toFixed(1)} KB`);
}
