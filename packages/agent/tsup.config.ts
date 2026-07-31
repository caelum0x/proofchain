import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  // A build-only tsconfig WITHOUT the `paths` alias, so esbuild resolves
  // `@proofchain/shared` as a bare external import (the alias only exists to
  // point tsc/vitest at the local test double).
  tsconfig: 'tsconfig.build.json',
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  dts: true,
  clean: true,
  sourcemap: true,
  // Keep dependencies external; `@proofchain/shared` is resolved from the
  // workspace at runtime after the integration-phase install. It is listed
  // explicitly so esbuild NEVER follows the tsconfig `paths` alias (which points
  // at the test double) into the production bundle.
  skipNodeModulesBundle: true,
  external: ['@proofchain/shared'],
});
