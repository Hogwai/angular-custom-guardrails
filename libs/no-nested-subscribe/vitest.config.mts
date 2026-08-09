import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/no-nested-subscribe',
  resolve: { tsconfigPaths: true },
    test: {
      name: 'no-nested-subscribe',
      watch: false,
      globals: true,
      testTimeout: 30000,
      environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/no-nested-subscribe',
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
