import { RuleTester } from '@typescript-eslint/rule-tester';
import * as vitest from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { rule } from './rule';

// Wire RuleTester to vitest lifecycle
RuleTester.afterAll = vitest.afterAll;
RuleTester.describe = vitest.describe;
RuleTester.it = vitest.it;
RuleTester.itOnly = vitest.it;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ['*.ts'],
        defaultProject: 'tsconfig.json',
      },
      tsconfigRootDir: process.cwd(),
    },
  },
});

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures');

const validFixtureCodes: string[] = [];
const invalidFixtureCodes: { code: string; errors: { messageId: 'tooDeep' }[] }[] = [];

const validDir = path.join(FIXTURES_DIR, 'valid');
const invalidDir = path.join(FIXTURES_DIR, 'invalid');

if (fs.existsSync(validDir)) {
  for (const file of fs.readdirSync(validDir).filter((f) => f.endsWith('.ts'))) {
    validFixtureCodes.push(
      fs.readFileSync(path.join(validDir, file), 'utf-8'),
    );
  }
}

if (fs.existsSync(invalidDir)) {
  for (const file of fs.readdirSync(invalidDir).filter((f) => f.endsWith('.ts'))) {
    invalidFixtureCodes.push({
      code: fs.readFileSync(path.join(invalidDir, file), 'utf-8'),
      errors: [{ messageId: 'tooDeep' as const }],
    });
  }
}

ruleTester.run('max-pipe-depth', rule, {
  valid: [
    // Two operators, under the limit
    {
      code: 'import { of } from "rxjs"; import { map, filter } from "rxjs/operators"; const s = of(1).pipe(map((x: number) => x), filter(Boolean));',
    },
    // Three operators, at the limit
    {
      code: 'import { of } from "rxjs"; import { map, filter, take } from "rxjs/operators"; const s = of(1).pipe(map((x: number) => x), filter(Boolean), take(1));',
    },
    // Unrelated pipe() method, not an RxJS Observable (type-checker should reject)
    {
      code: 'const result = obj.pipe(1, 2, 3, 4);',
    },
    // Explicitly typed non-RxJS object with its own pipe() method
    {
      code: 'class Fake { pipe(...operators: unknown[]): this { return this; } } const obj = new Fake(); obj.pipe(1, 2, 3, 4);',
    },
    // Dynamically computed member, not statically `pipe`, so never reported
    {
      code: 'import { of } from "rxjs"; import { map, filter, tap, take } from "rxjs/operators"; const method: string = "pipe"; const s = of(1)[method](map((x: number) => x), filter(Boolean), tap(() => {}), take(1));',
    },
    // `pipe` bound to a *different* property (`subscribe`), not a pipe call
    {
      code: 'import { of } from "rxjs"; import { map, filter, tap, take } from "rxjs/operators"; const source$ = of(1); const { subscribe: pipe } = source$; const s = pipe(map((x: number) => x), filter(Boolean), tap(() => {}), take(1));',
    },
    // Rest binding is not the Observable pipe property.
    {
      code: 'import { of } from "rxjs"; import { map, filter, tap, take } from "rxjs/operators"; const source$ = of(1); const { ...pipe } = source$; const s = pipe(map((x: number) => x), filter(Boolean), tap(() => {}), take(1));',
    },
    // Fixtures
    ...validFixtureCodes.map((code) => ({ code })),
  ],
  invalid: [
    {
      code: 'import { of } from "rxjs"; import { map, filter, tap, take } from "rxjs/operators"; const s = of(1).pipe(map((x: number) => x), filter(Boolean), tap(() => {}), take(1));',
      options: [{ max: 3 }],
      errors: [{ messageId: 'tooDeep', data: { actual: '4', max: '3' } }],
    },
    {
      code: 'import { of } from "rxjs"; import { map, filter, tap, take, catchError } from "rxjs/operators"; const s = of(1).pipe(map((x: number) => x), filter(Boolean), tap(() => {}), take(1), catchError(() => of(null)));',
      options: [{ max: 3 }],
      errors: [{ messageId: 'tooDeep', data: { actual: '5', max: '3' } }],
    },
    // Computed access with a static string key, same as a plain `.pipe()`
    {
      code: 'import { of } from "rxjs"; import { map, filter, tap, take } from "rxjs/operators"; const s = of(1)["pipe"](map((x: number) => x), filter(Boolean), tap(() => {}), take(1));',
      options: [{ max: 3 }],
      errors: [{ messageId: 'tooDeep', data: { actual: '4', max: '3' } }],
    },
    // `pipe` destructured out of an Observable via an ObjectPattern
    {
      code: 'import { of } from "rxjs"; import { map, filter, tap, take } from "rxjs/operators"; const source$ = of(1); const { pipe } = source$; const s = pipe(map((x: number) => x), filter(Boolean), tap(() => {}), take(1));',
      options: [{ max: 3 }],
      errors: [{ messageId: 'tooDeep', data: { actual: '4', max: '3' } }],
    },
    // Explicitly `any`-typed source with real RxJS operators: the strict policy reports a clear `.pipe()` over the limit
    {
      code: 'import { of } from "rxjs"; import { map, filter, tap, take } from "rxjs/operators"; declare const source$: any; source$.pipe(map((x: number) => x), filter(Boolean), tap(() => {}), take(1));',
      options: [{ max: 3 }],
      errors: [{ messageId: 'tooDeep', data: { actual: '4', max: '3' } }],
    },
    // Explicitly `unknown`-typed source: same strict policy applies
    {
      code: 'import { of } from "rxjs"; import { map, filter, tap, take } from "rxjs/operators"; declare const source$: unknown; source$.pipe(map((x: number) => x), filter(Boolean), tap(() => {}), take(1));',
      options: [{ max: 3 }],
      errors: [{ messageId: 'tooDeep', data: { actual: '4', max: '3' } }],
    },
    // Fixtures
    ...invalidFixtureCodes,
  ],
});
