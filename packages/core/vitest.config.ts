import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    testTimeout: 10000,
    // Include default src tests + the __smoke__ consumer test that exercises
    // the built dist/ tarball to guard against broken publishes.
    include: [
      'src/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      '__smoke__/**/*.test.?(c|m)[jt]s?(x)',
    ],
  },
});
