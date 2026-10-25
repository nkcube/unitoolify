/** @type {import("prettier").Config} */
export default {
  printWidth: 80,
  htmlWhitespaceSensitivity: "css",
  proseWrap: "always",
  overrides: [
    {
      files: "*.md",
      options: { proseWrap: "preserve" },
    },
  ],
};
