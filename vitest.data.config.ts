import { defineConfig } from 'vitest/config';

// Config for the on-demand data-quality audit (npm run test:data /
// test:data:links). Deliberately NOT the default vitest.config.ts, so these
// suites never gate plain `npm test` — see data/__tests__/README.md for why.
export default defineConfig({
  test: {
    include: ['data/__tests__/**/*.test.ts'],
  },
});
