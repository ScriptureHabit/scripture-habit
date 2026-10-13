import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
