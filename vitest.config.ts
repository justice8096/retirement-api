import { defineConfig } from 'vitest/config';

// Default vitest project: the API + shared-engine test suite that gates CI.
//
// Explicitly scoped to the pre-C1 surface (src/__tests__ + shared/__tests__)
// so that `npm test` stays a green, deterministic CI gate. The data-quality
// suites adopted from the retirement-dashboard React repo in data/__tests__/
// are a separate on-demand audit (see data/__tests__/README.md) — they
// surface real, pre-existing content-authoring gaps in data/locations/ that
// nobody has scheduled work against yet, so they must not fail this gate.
// Run them explicitly via `npm run test:data` (see vitest.data.config.ts).
export default defineConfig({
  test: {
    include: [
      'src/__tests__/**/*.test.ts',
      'shared/__tests__/**/*.test.{js,ts}',
    ],
  },
});
