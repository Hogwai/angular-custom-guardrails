# no-index-track

ESLint rule for Angular templates: disallows using the bare `$index` loop
variable in `@for` track expressions.

Tracking by `$index` is fragile for dynamic collections (insertions,
removals, reordering break the identity mapping and cause unnecessary DOM
updates or state loss). Track a stable item identity instead.

## Scope

The rule flags any `@for` loop whose track expression reads the bare
`$index` variable, directly or anywhere in a derived expression:

```html
<!-- Invalid: direct use -->
@for (user of users; track $index) { <p>{{ user.name }}</p> }

<!-- Invalid: derived expressions still depend on $index -->
@for (user of users; track $index + 0) { <p>{{ user.name }}</p> }
@for (user of users; track $index.toString()) { <p>{{ user.name }}</p> }
```

Member accesses on a collection item are **not** flagged, even when the
property happens to be named `$index`:

```html
<!-- Valid: tracks the item's own property -->
@for (item of items; track item.$index) { <span>{{ item.label }}</span> }

<!-- Valid: stable identity / composite keys -->
@for (user of users; track user.id) { <p>{{ user.name }}</p> }
@for (item of items; track item.type + item.id) { <span>{{ item.label }}</span> }
```

## Detection

The track expression is parsed into Angular's template AST and visited
recursively with `RecursiveAstVisitor`. Detection is dispatch-based: each
AST node invokes the matching visitor callback, so the rule never relies on
`constructor.name` strings or on `instanceof` against a specific compiler
module copy (the template parser instantiates its own bundled compiler).
A `PropertyRead` named `$index` is flagged when its direct receiver is an
implicit receiver, which matches the bare `$index` variable in any position
of the expression tree.

## Building

Run `nx build no-index-track` to build the library.

## Running unit tests

Run `nx test no-index-track` to execute the unit tests via [Vitest](https://vitest.dev/).
