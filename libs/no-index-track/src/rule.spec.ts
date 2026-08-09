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
  errors: { messageId: 'indexTrack' }[];
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
      errors: [{ messageId: 'indexTrack' }],
    });
  }
}

ruleTester.run('no-index-track', rule, {
  valid: [
    // Tracking by stable identity
    {
      code: '@for (user of users; track user.id) { <p>{{ user.name }}</p> }',
    },
    // Tracking by stable composite key
    {
      code: '@for (item of items; track item.type + item.id) { <span>{{ item.label }}</span> }',
    },
    // item.$index is NOT bare $index, so it should not be flagged
    {
      code: '@for (item of items; track item.$index) { <span>{{ item.label }}</span> }',
    },
    // Fixtures
    ...validFixtureCodes.map((code) => ({ code })),
  ],
  invalid: [
    // Tracking by $index
    {
      code: '@for (user of users; track $index) { <p>{{ user.name }}</p> }',
      errors: [{ messageId: 'indexTrack' }],
    },
    // Multiline tracking by $index
    {
      code: `@for (user of users; track $index) {
  <p>{{ user.name }}</p>
}`,
      errors: [{ messageId: 'indexTrack' }],
    },
    // Derived from $index: arithmetic expression
    {
      code: '@for (user of users; track $index + 0) { <p>{{ user.name }}</p> }',
      errors: [{ messageId: 'indexTrack' }],
    },
    // Derived from $index: method call on the bare $index variable
    {
      code: '@for (user of users; track $index.toString()) { <p>{{ user.name }}</p> }',
      errors: [{ messageId: 'indexTrack' }],
    },
    // Fixtures
    ...invalidFixtureCodes,
  ],
});
