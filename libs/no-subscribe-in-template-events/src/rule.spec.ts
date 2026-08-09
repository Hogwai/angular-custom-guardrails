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
  errors: { messageId: 'subscribeInTemplateEvent' }[];
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
      errors: [{ messageId: 'subscribeInTemplateEvent' }],
    });
  }
}

ruleTester.run('no-subscribe-in-template-events', rule, {
  valid: [
    // A plain method call in a handler is fine
    {
      code: '<button (click)="reload()">Reload</button>',
    },
    // A bare subscribe() call has no receiver: it may be a business action
    // on the component, so it is not flagged
    {
      code: '<button (click)="subscribe()">Subscribe</button>',
    },
    // A member call on an observable that is not subscribe is fine
    {
      code: '<button (click)="users$.next()">Next</button>',
    },
    // A member call whose name is not subscribe is fine
    {
      code: '<button (click)="users$.emit()">Emit</button>',
    },
    // subscribe() in an interpolation is not inside an event handler, so it
    // is not inspected
    {
      code: '<p>{{ users$.subscribe() }}</p>',
    },
    // subscribe() in a property binding is not inside an event handler
    {
      code: '<input [value]="users$.subscribe()" />',
    },
    // subscribe is only read (as the receiver of another member access),
    // never called: stream.subscribe?.other() calls other(), not subscribe
    {
      code: '<button (click)="stream.subscribe?.other()">Other</button>',
    },
    // subscribe is only read (as an argument of the inner call), never
    // called: factory(stream.subscribe)() calls the returned function
    {
      code: '<button (click)="factory(stream.subscribe)()">Go</button>',
    },
    // Fixtures
    ...validFixtureCodes.map((code) => ({ code })),
  ],
  invalid: [
    // A member call named subscribe on an observable
    {
      code: '<button (click)="users$.subscribe()">Subscribe</button>',
      errors: [{ messageId: 'subscribeInTemplateEvent' }],
    },
    // Same with an explicit this receiver and an argument
    {
      code: '<button (click)="this.users$.subscribe(handle)">Subscribe</button>',
      errors: [{ messageId: 'subscribeInTemplateEvent' }],
    },
    // A subscribe member call nested inside another call
    {
      code: '<button (click)="log(users$.subscribe())">Log</button>',
      errors: [{ messageId: 'subscribeInTemplateEvent' }],
    },
    // Safe navigation on the receiver of the subscribe member call
    {
      code: '<button (click)="users$?.subscribe()">Subscribe</button>',
      errors: [{ messageId: 'subscribeInTemplateEvent' }],
    },
    // Same safe navigation nested inside another call
    {
      code: '<button (click)="log(users$?.subscribe())">Log</button>',
      errors: [{ messageId: 'subscribeInTemplateEvent' }],
    },
    // Safe call of the subscribe member
    {
      code: '<button (click)="users$.subscribe?.()">Subscribe</button>',
      errors: [{ messageId: 'subscribeInTemplateEvent' }],
    },
    // Two real nested subscribe calls in the same handler: both are
    // reported
    {
      code: '<button (click)="log(users$.subscribe()); track(users$.subscribe())">Go</button>',
      errors: [
        { messageId: 'subscribeInTemplateEvent' },
        { messageId: 'subscribeInTemplateEvent' },
      ],
    },
    // Fixtures
    ...invalidFixtureCodes,
  ],
});
