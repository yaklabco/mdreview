import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/helpers/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.ts',
        'scripts/**',
      ],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 70,
        statements: 75,
      },
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './packages/chrome-ext/src'),
      // Keep `@mdreview/core` resolving to source while the published
      // package ships `dist/`. Existing tests mock relative paths under
      // `packages/core/src/...`, and those mocks only intercept when the
      // importing module also resolves through the same source files.
      // Subpath aliases mirror the subpath exports in packages/core/package.json.
      '@mdreview/core/node': resolve(__dirname, './packages/core/src/node.ts'),
      '@mdreview/core/sw': resolve(__dirname, './packages/core/src/sw.ts'),
      '@mdreview/core/adapters': resolve(__dirname, './packages/core/src/adapters.ts'),
      '@mdreview/core/utils/debug-logger': resolve(
        __dirname,
        './packages/core/src/utils/debug-logger.ts'
      ),
      '@mdreview/core': resolve(__dirname, './packages/core/src/index.ts'),
    },
  },
});

