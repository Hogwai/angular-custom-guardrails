# max-pipe-depth

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build max-pipe-depth` to build the library.

## Running unit tests

Run `nx test max-pipe-depth` to execute the unit tests via [Vitest](https://vitest.dev/).

## Rule behavior

`max-pipe-depth` reports RxJS `pipe` calls whose operator count exceeds the
configured maximum (`max`, default `3`).

The rule is type-aware and uses the TypeScript checker to decide whether a
reported call really operates on an RxJS `Observable` (the `pipe` and
`subscribe` members must originate from the `rxjs` package).

### Recognized call forms

- Plain member access: `source$.pipe(op1, op2, op3, op4)`
- Static computed access: `source$['pipe'](op1, op2, op3, op4)`
- Destructured `pipe`: `const { pipe } = source$; pipe(op1, op2, op3, op4)`
  (resolved through the variable declaration of the `ObjectPattern` binding)
- `any`/`unknown` sources: if the invoked form is statically `pipe` and
  exceeds the maximum, it is reported (strict policy) instead of being
  ignored. Known non-RxJS object types are never reported.

### Out of scope

- Dynamically computed member access such as `source$[key](...)`.
- `Observable.prototype.pipe.call(...)`: the callee is not a member access on
  an observable instance, so this form is intentionally not resolved.
- Objects whose type is known and not an RxJS `Observable` (including
  undeclared identifiers, e.g. `obj.pipe(1, 2, 3, 4)`).
