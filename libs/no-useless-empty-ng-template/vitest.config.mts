import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/no-useless-empty-ng-template',
  resolve: { tsconfigPaths: true },
    test: {
      name: 'no-useless-empty-ng-template',
      watch: false,
      globals: true,
      testTimeout: 30000,
      environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/no-useless-empty-ng-template',
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
