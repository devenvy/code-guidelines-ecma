import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.mjs'],
    testTimeout: 120_000,
    hookTimeout: 300_000,
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/**', 'scripts/**/*.mjs'],
      // bin.mjs is a 3-line entry point exercised for real by the pack test (a subprocess)
      exclude: ['src/cli/bin.mjs'],
      reporter: ['text-summary', 'json-summary', 'json', 'html'],
      thresholds: { statements: 85, branches: 85, functions: 85, lines: 85 },
    },
  },
});
