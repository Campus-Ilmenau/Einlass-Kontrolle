import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    // argon2 und Postgres brauchen etwas Zeit
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
