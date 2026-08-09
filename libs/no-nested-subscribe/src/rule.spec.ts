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
const invalidFixtureCodes: { code: string; errors: { messageId: string }[] }[] = [];

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
      errors: [{ messageId: 'nestedSubscribe' }],
    });
  }
}

ruleTester.run('no-nested-subscribe', rule, {
  valid: [
    // Sequential subscriptions, not nested
    {
      code: 'import { of } from "rxjs"; const outer$ = of(1); const inner$ = of(2); outer$.subscribe(v => console.log(v)); inner$.subscribe(v => console.log(v));',
    },
    // Non-RxJS subscribe
    {
      code: 'class Fake { subscribe(cb: Function) { cb(); } } const f = new Fake(); f.subscribe(() => { const g = new Fake(); g.subscribe(() => {}); });',
    },
    // Using higher-order operator instead of nesting
    {
      code: 'import { of } from "rxjs"; import { switchMap } from "rxjs/operators"; of(1).pipe(switchMap(v => of(v))).subscribe(v => console.log(v));',
    },
    // Fake non-RxJS subscribe (object with subscribe method, no rxjs type)
    {
      code: 'const fake = { subscribe() { const inner = { subscribe() {} }; inner.subscribe(); } }; fake.subscribe();',
    },
    // Two sequential subscriptions via computed access, no nesting
    {
      code: `import { of } from 'rxjs';
of(1)['subscribe']((v: number) => console.log(v));
of(2)['subscribe']((v: number) => console.log(v));`,
    },
    // Non-RxJS object with subscribe accessed via computed member, no false positive
    {
      code: `const fake = {
  subscribe(cb: (v: number) => void) {
    cb(1);
  },
};
fake['subscribe']((v: number) => {
  fake.subscribe(() => {});
});`,
    },
    // Fixtures
    ...validFixtureCodes.map((code) => ({ code })),
  ],
  invalid: [
    // Nested callback subscribe
    {
      code: 'import { of } from "rxjs"; of(1).subscribe(v => of(2).subscribe(inner => console.log(v, inner)));',
      errors: [{ messageId: 'nestedSubscribe' }],
    },
    // Nested observer-object subscribe
    {
      code: 'import { of } from "rxjs"; of(1).subscribe({ next: v => of(2).subscribe({ next: inner => console.log(v, inner) }) });',
      errors: [{ messageId: 'nestedSubscribe' }],
    },
    // Nested multiline subscribe
    {
      code: `import { of } from "rxjs";
of(1).subscribe(v => {
  of(2).subscribe(inner => {
    console.log(v, inner);
  });
});`,
      errors: [{ messageId: 'nestedSubscribe' }],
    },
    // Observer with method shorthand syntax: next(v) { ... }
    {
      code: `import { of } from "rxjs";
of(1).subscribe({ next(v) { of(2).subscribe(inner => console.log(v, inner)); } });`,
      errors: [{ messageId: 'nestedSubscribe' }],
    },
    // Observer with next: function expression
    {
      code: `import { of } from "rxjs";
of(1).subscribe({ next: function(v) { of(2).subscribe(inner => console.log(v, inner)); } });`,
      errors: [{ messageId: 'nestedSubscribe' }],
    },
    // Subscribable variable, recognized as rxjs (subscribe only, no pipe required)
    {
      code: `import { Subscribable } from "rxjs";
declare const s: Subscribable<number>;
s.subscribe({ next: (v) => { const s2: Subscribable<number> = s; s2.subscribe({ next: () => {} }); } });`,
      errors: [{ messageId: 'nestedSubscribe' }],
    },
    // Named callback referenced by identifier, arrow function stored in a variable
    {
      code: `import { of } from 'rxjs';

const callback = () => {
  of(2).subscribe(() => {});
};

of(1).subscribe(callback);`,
      errors: [{ messageId: 'nestedSubscribe' }],
    },
    // Named callback referenced by identifier, function declaration (hoisted use)
    {
      code: `import { of } from 'rxjs';

function handleValue() {
  of(2).subscribe(() => {});
}

of(1).subscribe(handleValue);`,
      errors: [{ messageId: 'nestedSubscribe' }],
    },
    // Computed subscribe access ['subscribe'], static member bypass
    {
      code: `import { of } from 'rxjs';

of(1)['subscribe'](() => {
  of(2).subscribe(() => {});
});`,
      errors: [{ messageId: 'nestedSubscribe' }],
    },
    // Fixtures
    ...invalidFixtureCodes,
  ],
});
