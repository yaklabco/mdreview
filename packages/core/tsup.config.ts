import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    node: "src/node.ts",
    sw: "src/sw.ts",
    adapters: "src/adapters.ts",
    "utils/debug-logger": "src/utils/debug-logger.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: "inline",
  clean: true,
  target: "es2022",
  outDir: "dist",
  external: [
    "markdown-it",
    "markdown-it-anchor",
    "markdown-it-attrs",
    "markdown-it-emoji",
    "markdown-it-footnote",
    "markdown-it-task-lists",
    "mermaid",
    "panzoom",
    "highlight.js",
    "dompurify",
    "@jamesainslie/docx",
  ],
});
