import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environmentMatchGlobs: [
      ['src/main/**/*.test.ts', 'node'],
      ['src/renderer/**/*.test.ts', 'jsdom'],
      ['src/preload/**/*.test.ts', 'node'],
      ['src/shared/**/*.test.ts', 'node'],
    ],
    testTimeout: 10000,
  },
});
