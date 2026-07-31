import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * The agent depends on `@proofchain/shared` (a workspace package that is built
 * during the integration phase). To keep this package independently testable —
 * with NO real API key and NO network — tests resolve `@proofchain/shared`
 * to an in-package deterministic test double. See test/doubles/shared.ts and
 * README.md ("Testability").
 */
const sharedDouble = fileURLToPath(
  new URL('./test/doubles/shared.ts', import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: {
      '@proofchain/shared': sharedDouble,
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/*.d.ts'],
    },
  },
});
