# no-useless-empty-ng-template

ESLint rule for Angular templates: disallows empty `ng-template` elements
that carry neither content nor template metadata.

An `<ng-template>` element only makes sense when it has something to say:
content to stamp out, a template reference or variable for
`ngTemplateOutlet`/`TemplateRef`, or bindings. A template with none of
these renders nothing and is dead weight in the source.

## Scope

Only explicitly written `<ng-template>` elements are inspected. A template
is reported only when **all** of the following hold:

- it has no template reference (`#ref`), no template variable (`let-item`),
  no plain attribute (`foo="bar"`), no bound input (`[input]="..."`), no
  bound output (`(output)="..."`) and no structural directive
  (`*directive`);
- every child is insignificant — only whitespace and line breaks, which
  count as no content at all.

```html
<!-- Invalid: empty, no metadata -->
<ng-template></ng-template>

<!-- Invalid: whitespace-only content still counts as empty -->
<ng-template>
  
</ng-template>

<!-- Valid: template reference -->
<ng-template #loading></ng-template>

<!-- Valid: template variable -->
<ng-template let-item></ng-template>

<!-- Valid: bound input / output / plain attribute -->
<ng-template [context]="value"></ng-template>
<ng-template (done)="go()"></ng-template>
<ng-template foo="bar"></ng-template>

<!-- Valid: structural directive -->
<ng-template *ngIf="cond"></ng-template>

<!-- Valid: non-empty -->
<ng-template><span>content</span></ng-template>
```

Non-`ng-template` elements (`<div></div>`), non-empty templates and the
implicit templates created by structural syntax (`<div *ngIf="cond">`) are
never reported.

## Detection

The explicit `<ng-template>` element is recognized by its
`tagName === 'ng-template'` on the parsed `Template` AST node. Implicit
templates created by structural syntax never have `tagName === 'ng-template'`
and are therefore always skipped: the wrapper template of `<div *ngIf="cond">`
is a `Template` node whose tag name is the host element name, while the
wrapper around `<ng-template *directive>` carries no tag name at all.
Children are inspected by duck-typing the string `value` property of plain
text nodes, never by `constructor.name` strings nor by `instanceof` against
a particular compiler module copy: the template parser instantiates its own
bundled compiler, and node identity checks across copies would silently
fail. The desugaring target of a structural directive applied to an
`<ng-template>` (`*ngIf` on the element itself) is tracked by node identity
within the single parse and never reported.

## Building

Run `nx build no-useless-empty-ng-template` to build the library.

## Running unit tests

Run `nx test no-useless-empty-ng-template` to execute the unit tests via [Vitest](https://vitest.dev/).
