import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    projects: [
      {
        test: {
          name: 'renderer',
          include: ['src/renderer/**/*.test.ts'],
          environment: 'jsdom',
          globals: true,
        },
      },
      {
        test: {
          name: 'main',
          include: ['src/main/**/*.test.ts'],
          environment: 'node',
          globals: true,
        },
      },
      {
        test: {
          name: 'preload',
          include: ['src/preload/**/*.test.ts'],
          environment: 'node',
          globals: true,
        },
      },
      {
        test: {
          name: 'shared',
          include: ['src/shared/**/*.test.ts'],
          environment: 'node',
          globals: true,
        },
      },
    ],
  },
});
