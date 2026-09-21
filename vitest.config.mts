import path from 'path';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    env: {
      MONGO_URI: 'mongodb://localhost/skintwin-test',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
});
