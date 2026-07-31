import { defineConfig } from 'tsup';

/**
 * The API uses @fastify/autoload to register every plugin file under
 * `src/routes/` at runtime by reading the directory from disk. A single bundled
 * output would erase that directory AND duplicate shared modules across route
 * bundles (breaking `instanceof ApiError` in the central error handler).
 *
 * So we DON'T bundle: each `src/**\/*.ts` is transpiled in place, preserving the
 * directory tree into `dist/` (so `dist/routes/*.js` exists for the autoloader)
 * and keeping ONE module instance per file. Relative imports already carry `.js`
 * extensions for Node ESM; workspace imports (`@proofchain/shared`,
 * `@proofchain/infra`) stay as bare specifiers resolved at runtime.
 */
export default defineConfig({
  entry: ['src/**/*.ts'],
  tsconfig: 'tsconfig.build.json',
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  bundle: false,
  splitting: false,
  dts: false,
  clean: true,
  sourcemap: true,
});
