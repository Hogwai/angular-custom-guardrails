import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/playground',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'playground-integration',
    watch: false,
    globals: true,
    testTimeout: 30000,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{ts,mts}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/playground',
      provider: 'v8' as const,
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
}));
