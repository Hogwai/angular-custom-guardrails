# Angular Guard Rails (local copies)

This folder contains standalone copies of the six ESLint rules, dropped
directly into the playground's own source tree, exactly like an application
that copied the rules it needs into its project.

| Rule                              | Purpose                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `max-pipe-depth`                  | Limits the number of operators passed to an RxJS `pipe()` call (type-aware)                            |
| `no-nested-subscribe`             | Forbids `subscribe()` calls inside another `subscribe()` callback                                      |
| `no-index-track`                  | Angular template rule forbidding bare `track $index` in `@for` loops                                   |
| `no-duplicate-async-pipe`         | Angular template rule forbidding repeated `async` pipes on the same expression within a template scope |
| `no-subscribe-in-template-events` | Angular template rule forbidding `subscribe()` calls inside template event handlers                    |
| `no-useless-empty-ng-template`    | Angular template rule forbidding empty `ng-template` elements without content or template metadata     |

## Autonomous copies

Each subfolder is self-contained:

- it exports the ready-to-use `rule` from its `index.ts`;
- it does **not** import from other guard rail folders nor from any shared
  aggregator package;
- there is no shared `eslint-plugin` aggregator in this workspace anymore;
  the playground composes the rules itself in `eslint.config.ts`.

Because the copies are independent, an application that only needs one rule
can keep a single subfolder and delete the other five, adjusting the imports
in its ESLint flat config accordingly.

## Type-aware linting

`max-pipe-depth` and `no-nested-subscribe` rely on the TypeScript type
checker via `@typescript-eslint/parser` (`parserOptions.projectService`).
`no-index-track`, `no-duplicate-async-pipe`, `no-subscribe-in-template-events`
and `no-useless-empty-ng-template` are template rules and need
`@angular-eslint/template-parser`. The playground wires both parsers in its
flat config.
