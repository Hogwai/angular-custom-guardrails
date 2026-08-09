# Angular Custom Guard Rails

A self-contained Angular/Nx showcase demonstrating four independently testable custom guard rails for code quality enforcement.

## Prerequisites

- **Node.js** >= 18 (LTS recommended)
- **npm** >= 9

## Architecture

```mermaid
graph TD
    A[apps/playground] --> C["apps/playground/tools/angular-guardrails/max-pipe-depth"]
    A --> D["apps/playground/tools/angular-guardrails/no-nested-subscribe"]
    A --> E["apps/playground/tools/angular-guardrails/no-index-track"]
    F[libs/no-absolute-scss-url] --> G[fixtures/]
    F -.-> H[CLI checker]
```

- **playground** : Angular app that complies with all four guard rails; consumes the three ESLint rules from its own standalone copies under `tools/angular-guardrails`, exactly like an application that copied the rules into its own source tree
- **max-pipe-depth** : ESLint rule limiting RxJS pipe operator count
- **no-nested-subscribe** : ESLint rule forbidding subscribe inside subscribe
- **no-index-track** : Angular template ESLint rule forbidding `track $index`
- **no-absolute-scss-url** : Standalone CLI checker for absolute URLs in SCSS

## Tech Stack

- Angular 22 / Nx 23
- TypeScript 6 / ESLint 9 (flat config)
- typescript-eslint 8 / angular-eslint 22
- Vitest 4
- PostCSS SCSS parser + postcss-value-parser

## Quick Start

```bash
npm install
```

No custom package has to be built or installed: every guard rail is a plain source folder in this workspace, and the SCSS checker runs directly from `dist` once the libraries are built.

Run the full guard rails check:

```bash
npm run guardrails:check
```

## Commands

### Run the full guard rails check

```bash
npm run guardrails:check
```

Runs all tests, all lint tasks, all builds and finally the SCSS checker on `apps/playground/src`. Exits with code `0` only when everything passes. This is also what the CI workflow runs.

### Run all tests

```bash
npx nx run-many -t test
```

### Run all lint checks

```bash
npx nx run-many -t lint
```

### Test a single rule

```bash
npx nx test max-pipe-depth
npx nx test no-nested-subscribe
npx nx test no-index-track
npx nx test no-absolute-scss-url
```

### Lint the playground

```bash
npx nx lint playground
```

## Importing a rule directly

Each rule folder under `apps/playground/tools/angular-guardrails` is a standalone copy that exports a ready-to-use ESLint rule from its `index.ts`. No aggregator package is required: an application imports the rules it needs directly into its local flat config, or copies a single rule folder into its own source tree.

The playground consumes each rule from its own local copy:

```ts
// apps/playground/eslint.config.ts
import { rule as maxPipeDepth } from './tools/angular-guardrails/max-pipe-depth';
import { rule as noNestedSubscribe } from './tools/angular-guardrails/no-nested-subscribe';
import { rule as noIndexTrack } from './tools/angular-guardrails/no-index-track';

const customGuardrails = {
  rules: {
    'max-pipe-depth': maxPipeDepth,
    'no-nested-subscribe': noNestedSubscribe,
    'no-index-track': noIndexTrack,
  },
};

export default [
  // ...
  {
    files: ['**/*.ts'],
    plugins: { 'custom-guardrails': customGuardrails },
    rules: {
      'custom-guardrails/max-pipe-depth': ['error', { max: 3 }],
      'custom-guardrails/no-nested-subscribe': 'error',
    },
  },
  {
    files: ['**/*.html'],
    plugins: { 'custom-guardrails': customGuardrails },
    rules: { 'custom-guardrails/no-index-track': 'error' },
  },
];
```

### Copying a single rule into your own app

If you only need one rule, copy its folder (for example `apps/playground/tools/angular-guardrails/no-nested-subscribe`) into your application, with no workspace reference and no package installation involved. The folder exports `rule` from `index.ts`, which you register in a flat ESLint plugin:

```ts
// eslint.config.ts
import { rule as noNestedSubscribe } from './tools/angular-guardrails/no-nested-subscribe';

const customGuardrails = {
  rules: { 'no-nested-subscribe': noNestedSubscribe },
};

export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser, // @typescript-eslint/parser
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'custom-guardrails': customGuardrails },
    rules: { 'custom-guardrails/no-nested-subscribe': 'error' },
  },
];
```

The TypeScript parser (`@typescript-eslint/parser`) is required so rules that rely on the type checker, such as `max-pipe-depth`, can resolve types through `parserOptions.projectService`. `no-nested-subscribe` itself only needs the parsed AST.

### Build the playground

```bash
npx nx build playground
```

### SCSS: check files or folders for absolute URLs

The checker accepts single files, multiple files and directories (directories are walked recursively and only `.scss` files are checked). It prints each violation and exits with code `1` when any is found.

```bash
# Build the checker first
npx nx build no-absolute-scss-url

# Check a single file
node dist/libs/no-absolute-scss-url/src/check.js path/to/file.scss

# Check multiple files
node dist/libs/no-absolute-scss-url/src/check.js file1.scss file2.scss

# Check a whole folder (recursive)
node dist/libs/no-absolute-scss-url/src/check.js apps/playground/src
```

The equivalent Nx target is `check`:

```bash
npx nx run no-absolute-scss-url:check
```

### Full guard rails check

```bash
npm run guardrails:check
```

## Guard Rails

### `max-pipe-depth`

Limits the number of operators passed to an RxJS `pipe()` call. Uses the TypeScript type checker to avoid false positives on non-RxJS `pipe` methods.

```ts
// Valid: 3 operators (at limit)
source$.pipe(map(x => x), filter(Boolean), take(1));

// Invalid: 4 operators (exceeds default limit of 3)
source$.pipe(map(x => x), filter(Boolean), tap(() => {}), take(1));
```

### `no-nested-subscribe`

Forbids `subscribe()` calls inside another `subscribe()` callback. Encourages higher-order mapping operators (`switchMap`, `concatMap`, etc.). Supports arrow callbacks, function expressions, and observer object methods.

```ts
// Valid: using switchMap
outer$.pipe(switchMap(v => inner$)).subscribe(console.log);

// Invalid: nested subscribe
outer$.subscribe(v => inner$.subscribe(inner => console.log(v, inner)));
```

### `no-index-track`

Angular template rule that flags bare `track $index` in `@for` loops, encouraging stable identity tracking.

```html
<!-- Valid: stable identity -->
@for (user of users; track user.id) { <p>{{ user.name }}</p> }

<!-- Invalid: tracking by index -->
@for (user of users; track $index) { <p>{{ user.name }}</p> }
```

### `no-absolute-scss-url`

Standalone CLI checker that flags absolute paths in SCSS `url()` declarations. Uses PostCSS SCSS parser for accurate AST analysis.

```scss
/* Valid */
.logo { background-image: url('./logo.svg'); }

/* Invalid */
.logo { background-image: url('/assets/logo.svg'); }
```

## Key Files

| File | Description |
|------|-------------|
| [`libs/max-pipe-depth/src/rule.ts`](libs/max-pipe-depth/src/rule.ts) | RxJS pipe depth rule implementation |
| [`libs/no-nested-subscribe/src/rule.ts`](libs/no-nested-subscribe/src/rule.ts) | Nested subscribe rule implementation |
| [`libs/no-index-track/src/rule.ts`](libs/no-index-track/src/rule.ts) | Template $index tracking rule |
| [`libs/no-absolute-scss-url/src/check.ts`](libs/no-absolute-scss-url/src/check.ts) | SCSS URL checker + CLI entry point |
| [`apps/playground/eslint.config.ts`](apps/playground/eslint.config.ts) | Playground ESLint flat config composing the rules locally with TypeScript parser services |
| [`vitest.workspace.ts`](vitest.workspace.ts) | Vitest workspace configuration |
