import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'chrome-ext',
      include: ['tests/**/*.test.ts'],
    },
  },
  {
    extends: './packages/core/vitest.config.ts',
    test: {
      name: 'core',
      root: './packages/core',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    extends: './packages/electron/vitest.config.ts',
    test: {
      name: 'electron',
      root: './packages/electron',
      include: ['src/**/*.test.ts'],
    },
  },
]);
