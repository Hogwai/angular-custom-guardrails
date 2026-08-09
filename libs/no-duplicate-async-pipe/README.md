# no-duplicate-async-pipe

ESLint rule for Angular templates: disallows subscribing to the same
observable with the `async` pipe more than once within a template scope.

Every `{{ user$ | async }}` occurrence creates its own subscription with its
own lifecycle. Piping the same expression twice means the observable is
subscribed twice, each subscription firing independently. Alias the result
once instead (`@let`, or `*ngIf="... | async as ..."`).

## Scope

The rule inspects every `BindingPipe` whose name is exactly `async` and flags
the second and subsequent occurrences whose input expression is equivalent to
an expression already seen in the same scope. Two different observables piped
with `async` are always valid.

```html
<!-- Invalid: user$ is subscribed twice -->
<p>{{ user$ | async }}</p>
<p>{{ user$ | async }}</p>

<!-- Invalid: the @let pipe and the interpolation both subscribe -->
@let v = user$ | async;
<p>{{ user$ | async }}</p>

<!-- Valid: two different observables -->
<p>{{ user$ | async }}</p>
<p>{{ other$ | async }}</p>

<!-- Valid: non-async pipes are ignored -->
<p>{{ title | uppercase }}</p>

<!-- Valid: @else branches are distinct embedded scopes -->
@if (a) { <p>{{ user$ | async }}</p> } @else { <p>{{ user$ | async }}</p> }
```

## Equivalence

Two occurrences are duplicates when their pipe input expressions
(`BindingPipe.exp`) are equivalent. Equivalence is computed from the source
text of the input expression span only, never from the whole pipe span, so
the spacing around `| async` and the pipe arguments are irrelevant:

```html
<!-- Invalid: same input expression, different spacing around the pipe -->
{{ user$ | async }} {{ user$|async }}

<!-- Invalid: outer parentheses are transparent -->
{{ (user$) | async }} {{ user$ | async }}
```

Balanced parentheses wrapping the whole expression are removed (repeatedly,
so `((user$))` also matches) and whitespace outside string literals is
ignored. Whitespace inside string literals is preserved: `'a b'` and `'a  b'`
are different expressions.

## Embedded scopes

Each embedded view opens its own scope whose bounds are derived from the
view children only: `@if`/`@else` branch bodies, `@for` main and `@empty`
bodies, `@switch` case bodies, `@defer` and its placeholder/loading/error
bodies, and `ng-template` bodies. Pipes living in different scopes are never
compared, which avoids false positives between clearly distinct embedded
views (mutually exclusive branches, a loop body versus the surrounding
template, ...).

Header expressions of a block belong to the parent scope: the branch
condition, the loop expression and `track`, the `@switch` expression, the
`@defer` triggers and `ng-template` input bindings are evaluated in the
context surrounding the block. A pipe in `@if (user$ | async)` is therefore
compared with pipes around the block, but never with pipes in the branch
body:

```html
<!-- Valid: the condition and the body are different scopes -->
@if (user$ | async) { <p>{{ user$ | async }}</p> }

<!-- Invalid: the condition and the following interpolation share the
     parent scope, the later occurrence is flagged -->
@if (user$ | async) { } <p>{{ user$ | async }}</p>
```

The rule has no configuration: it always inspects every `async` pipe.

## Detection

The template parser exposes every template AST node (including `BindingPipe`
expression nodes and the embedded-view container nodes) to ESLint listeners,
so the rule is driven purely by listener dispatch. Source spans are read
through plain property access (numeric offsets for expression spans, offset
locations for template spans); the rule never relies on `constructor.name`
strings nor on `instanceof` against a specific compiler module copy (the
template parser instantiates its own bundled compiler).

## Building

Run `nx build no-duplicate-async-pipe` to build the library.

## Running unit tests

Run `nx test no-duplicate-async-pipe` to execute the unit tests via [Vitest](https://vitest.dev/).
