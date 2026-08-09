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
  errors: { messageId: 'uselessEmptyNgTemplate' }[];
}[] = [];

const validDir = path.join(FIXTURES_DIR, 'valid');
const invalidDir = path.join(FIXTURES_DIR, 'invalid');

// The fixture directories are the source of truth for the structural cases
// (and for the base cases listed below). Loading is mandatory: a missing
// directory must fail the test, never silently shrink coverage.
for (const file of fs.readdirSync(validDir).filter((f) => f.endsWith('.html'))) {
  validFixtureCodes.push(
    fs.readFileSync(path.join(validDir, file), 'utf-8'),
  );
}

for (const file of fs.readdirSync(invalidDir).filter((f) => f.endsWith('.html'))) {
  // Each invalid fixture expects exactly one report, always on the explicit
  // empty ng-template — never on an implicit structural wrapper.
  invalidFixtureCodes.push({
    code: fs.readFileSync(path.join(invalidDir, file), 'utf-8'),
    errors: [{ messageId: 'uselessEmptyNgTemplate' }],
  });
}

ruleTester.run('no-useless-empty-ng-template', rule, {
  valid: [
    // A template reference (#loading) is template metadata: not reported
    {
      code: '<ng-template #loading></ng-template>',
    },
    // A template variable (let-item) is template metadata: not reported
    {
      code: '<ng-template let-item></ng-template>',
    },
    // A bound input ([context]) is template metadata: not reported
    {
      code: '<ng-template [context]="value"></ng-template>',
    },
    // A bound output ((done)) is template metadata: not reported
    {
      code: '<ng-template (done)="go()"></ng-template>',
    },
    // A plain attribute (foo) is template metadata: not reported
    {
      code: '<ng-template foo="bar"></ng-template>',
    },
    // A structural directive applied to the ng-template: not reported
    {
      code: '<ng-template *ngIf="cond"></ng-template>',
    },
    // A bound input in the attribute form: not reported
    {
      code: '<ng-template [ngIf]="cond"></ng-template>',
    },
    // Non-whitespace content: not reported
    {
      code: '<ng-template><span>content</span></ng-template>',
    },
    // An interpolation is content: not reported
    {
      code: '<ng-template>{{ x }}</ng-template>',
    },
    // Not an ng-template element: not reported
    {
      code: '<div></div>',
    },
    // Implicit template created by a structural directive: not reported
    {
      code: '<div *ngIf="cond"></div>',
    },
    // An explicit empty ng-template nested inside a *ngIf'd div is still
    // explicitly written and empty: it is reported by the invalid fixtures
    // Fixtures
    ...validFixtureCodes.map((code) => ({ code })),
  ],
  invalid: [
    // A completely empty ng-template
    {
      code: '<ng-template></ng-template>',
      errors: [{ messageId: 'uselessEmptyNgTemplate' }],
    },
    // Whitespace-only content counts as no content
    {
      code: '<ng-template>\n  \n</ng-template>',
      errors: [{ messageId: 'uselessEmptyNgTemplate' }],
    },
    // Fixtures
    ...invalidFixtureCodes,
  ],
});
