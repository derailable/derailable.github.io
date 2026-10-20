import { defineConfig } from "vite-plus";

export default defineConfig({
  appType: "mpa",
  preview: {
    host: "127.0.0.1",
    port: 3001,
    strictPort: true,
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    embeddedLanguageFormatting: "auto",
    proseWrap: "always",
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
