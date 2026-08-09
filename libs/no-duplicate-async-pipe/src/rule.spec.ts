import { RuleTester } from '@angular-eslint/test-utils';
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
    parser: require('@angular-eslint/template-parser'),
  },
});

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures');

const validFixtureCodes: string[] = [];
const invalidFixtureCodes: {
  code: string;
  errors: { messageId: 'duplicateAsyncPipe' }[];
}[] = [];

const validDir = path.join(FIXTURES_DIR, 'valid');
const invalidDir = path.join(FIXTURES_DIR, 'invalid');

if (fs.existsSync(validDir)) {
  for (const file of fs.readdirSync(validDir).filter((f) => f.endsWith('.html'))) {
    validFixtureCodes.push(
      fs.readFileSync(path.join(validDir, file), 'utf-8'),
    );
  }
}

if (fs.existsSync(invalidDir)) {
  for (const file of fs.readdirSync(invalidDir).filter((f) => f.endsWith('.html'))) {
    invalidFixtureCodes.push({
      code: fs.readFileSync(path.join(invalidDir, file), 'utf-8'),
      errors: [{ messageId: 'duplicateAsyncPipe' }],
    });
  }
}

ruleTester.run('no-duplicate-async-pipe', rule, {
  valid: [
    // A single async pipe subscription
    {
      code: '<p>{{ user$ | async }}</p>',
    },
    // Two different observables, both piped with async
    {
      code: '<p>{{ user$ | async }}</p><p>{{ other$ | async }}</p>',
    },
    // A non-async pipe call is ignored
    {
      code: '<p>{{ title | uppercase }}</p>',
    },
    // The same observable piped once with async and once with another pipe
    {
      code: '<p>{{ user$ | async }}</p><p>{{ user$ | json }}</p>',
    },
    // A pipe in an @if header belongs to the parent scope, a pipe in the
    // branch body belongs to the branch scope: they are never compared
    {
      code: '@if (user$ | async) { <p>{{ user$ | async }}</p> }',
    },
    // Same split for @for: the loop expression is a header of the parent
    // scope, the body is its own embedded scope
    {
      code: '@for (item of (user$ | async); track item.id) { <p>{{ user$ | async }}</p> }',
    },
    // Same split for @switch: the switch expression is parent scope, each
    // case body is its own scope
    {
      code: "@switch (user$ | async) { @case ('a') { <p>{{ user$ | async }}</p> } }",
    },
    // Same split for @defer: the trigger is parent scope, the body is its
    // own embedded scope
    {
      code: '@defer (when user$ | async) { <p>{{ user$ | async }}</p> }',
    },
    // Same split for <ng-template>: input bindings are parent scope, the
    // template body is its own embedded scope
    {
      code: '<ng-template [x]="user$ | async">{{ user$ | async }}</ng-template>',
    },
    // Whitespace inside string literals is significant: 'a b' and 'a  b'
    // are different expressions
    {
      code: "{{ ('a b') | async }} {{ 'a  b' | async }}",
    },
    // Fixtures
    ...validFixtureCodes.map((code) => ({ code })),
  ],
  invalid: [
    // Duplicate async pipe in the root scope: exactly one error, located on
    // the second occurrence (column 24, 1-based: the start of the second
    // `user$`).
    {
      code: '{{ user$ | async }} {{ user$ | async }}',
      errors: [{ messageId: 'duplicateAsyncPipe', line: 1, column: 24 }],
    },
    // A third occurrence is reported as well
    {
      code: '{{ user$ | async }} {{ user$ | async }} {{ user$ | async }}',
      errors: [
        { messageId: 'duplicateAsyncPipe', line: 1, column: 24 },
        { messageId: 'duplicateAsyncPipe', line: 1, column: 44 },
      ],
    },
    // Duplicate across an @let declaration: the @let pipe subscribes and the
    // interpolation subscribes the same observable again
    {
      code: '@let v = user$ | async; {{ user$ | async }}',
      errors: [{ messageId: 'duplicateAsyncPipe', line: 1, column: 28 }],
    },
    // Same expression with different spacing around the pipe: the input
    // expression is the same, the second occurrence is flagged
    {
      code: '{{ user$ | async }} {{ user$|async }}',
      errors: [{ messageId: 'duplicateAsyncPipe', line: 1, column: 24 }],
    },
    // Same expression with outer parentheses on one occurrence only
    {
      code: '{{ (user$) | async }} {{ user$ | async }}',
      errors: [{ messageId: 'duplicateAsyncPipe', line: 1, column: 26 }],
    },
    // A pipe in an @if header and an identical pipe in the parent template
    // after the block share the parent scope: the later occurrence is
    // flagged
    {
      code: '@if (user$ | async) { } <p>{{ user$ | async }}</p>',
      errors: [{ messageId: 'duplicateAsyncPipe', line: 1, column: 31 }],
    },
    // Outer parentheses around a string literal are removed, but the string
    // content itself is preserved: 'a b' equals 'a b'
    {
      code: "{{ ('a b') | async }} {{ 'a b' | async }}",
      errors: [{ messageId: 'duplicateAsyncPipe', line: 1, column: 26 }],
    },
    // Fixtures
    ...invalidFixtureCodes,
  ],
});
