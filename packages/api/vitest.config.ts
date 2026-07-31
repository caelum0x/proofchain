import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * The API depends on the workspace packages `@proofchain/shared` and
 * `@proofchain/infra`, both built during the integration phase. To keep this
 * package independently testable — with NO network, NO RPC and NO Supabase —
 * tests resolve those imports to in-package deterministic test doubles. See
 * `test/doubles/*.ts` and README.md ("Testability").
 */
const sharedDouble = fileURLToPath(
  new URL('./test/doubles/shared.ts', import.meta.url),
);
const infraDouble = fileURLToPath(
  new URL('./test/doubles/infra.ts', import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: {
      '@proofchain/shared': sharedDouble,
      '@proofchain/infra': infraDouble,
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
