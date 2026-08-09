# no-subscribe-in-template-events

ESLint rule for Angular templates: disallows calling `subscribe` on an
observable inside a template event handler.

Subscribing inside an event handler starts a subscription with no lifecycle
tied to the view: every event fires a new subscription that is never
unsubscribed, leaking connections and risking stale emissions. Delegate the
operation to the component instead, which owns the subscription lifecycle.

## Scope

Only the expressions of Angular event bindings (`BoundEvent`, e.g.
`(click)="..."`, `(keyup.enter)="..."`) are inspected. Interpolations,
property bindings, attribute bindings and any other template expression are
never visited. Inside a handler, every member call whose method name is
exactly `subscribe` is reported, at any nesting depth:

```html
<!-- Invalid: subscribe is called on users$ inside the handler -->
<button (click)="users$.subscribe()">Load</button>

<!-- Invalid: this receiver and arguments do not change the verdict -->
<button (click)="this.users$.subscribe(handle)">Load</button>

<!-- Invalid: nested inside another call -->
<button (click)="log(users$.subscribe())">Log</button>

<!-- Valid: plain method call -->
<button (click)="reload()">Reload</button>

<!-- Valid: bare subscribe() has no receiver, it may be a business action -->
<button (click)="subscribe()">Go</button>

<!-- Valid: member call whose name is not subscribe -->
<button (click)="users$.next()">Next</button>

<!-- Valid: not an event handler expression -->
<p>{{ users$.subscribe() }}</p>
```

A bare `subscribe()` call (whose member access wraps an implicit receiver
) is never reported: without a receiver it may be a business action on the
component.

## Detection

The rule listens to every `BoundEvent` node and walks its handler
expression with `RecursiveAstVisitor`. Detection is dispatch-based: each
AST node invokes the matching visitor callback, so the rule never relies on
`constructor.name` strings nor on `instanceof` against a specific compiler
module copy (the template parser instantiates its own bundled compiler).
A call is reported when its callee dispatches as a member access
(`PropertyRead` or `SafePropertyRead`) named exactly `subscribe` whose own
receiver is not an implicit receiver, i.e. `users$.subscribe()`,
`users$?.subscribe()`, `users$.subscribe?.()`, `this.users$.subscribe(...)`,
or any of those nested inside another call. A `subscribe` that is only
read, never called, `stream.subscribe?.other()`,
`factory(stream.subscribe)()`, is never reported: the callee itself must
be the `subscribe` member access.

The rule has no configuration: it always inspects every event handler.

## Building

Run `nx build no-subscribe-in-template-events` to build the library.

## Running unit tests

Run `nx test no-subscribe-in-template-events` to execute the unit tests via [Vitest](https://vitest.dev/).
