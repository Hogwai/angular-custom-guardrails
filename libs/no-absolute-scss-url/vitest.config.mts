import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/no-absolute-scss-url',
  resolve: { tsconfigPaths: true },
    test: {
      name: 'no-absolute-scss-url',
      watch: false,
      globals: true,
      testTimeout: 30000,
      environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/no-absolute-scss-url',
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
