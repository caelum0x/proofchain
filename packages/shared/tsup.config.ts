import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "neutral",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  splitting: false,
  // Keep Node built-ins external so browser consumers can tree-shake the
  // optional deployment-file reader out of their bundles.
  external: ["node:fs", "node:module", "node:path"],
});
