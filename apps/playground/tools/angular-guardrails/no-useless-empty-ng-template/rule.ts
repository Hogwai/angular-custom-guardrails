import { getTemplateParserServices } from '@angular-eslint/utils';
import { TmplAstTemplate } from '@angular/compiler';
import { ESLintUtils } from '@typescript-eslint/utils';

/**
 * A child of a template is significant unless it is a plain text node whose
 * value is entirely whitespace. Text nodes are recognized by duck-typing the
 * string `value` property — never by `constructor.name` strings nor by
 * `instanceof` against a particular compiler module copy: the template
 * parser instantiates its own bundled compiler, and node identity checks
 * across copies would silently fail. With the parser configuration used by
 * `@angular-eslint/template-parser` (`preserveWhitespaces: true`) empty and
 * whitespace-only lines survive as `Text` children, so they must be
 * filtered out here. Any other child — an element, a nested template, an
 * interpolation, a block, ... — makes the template non-empty.
 */
function hasSignificantChild(node: TmplAstTemplate): boolean {
  for (const child of node.children) {
    const text = (child as { value?: unknown }).value;
    if (typeof text === 'string') {
      if (text.trim() !== '') {
        return true;
      }
      continue;
    }
    return true;
  }
  return false;
}

/**
 * ESLint rule for Angular templates: disallows empty `ng-template` elements
 * that carry neither content nor template metadata.
 *
 * An `<ng-template>` element only makes sense when it has something to say:
 * content to stamp out, a template reference (`#ref`) or variable
 * (`let-item`) for `ngTemplateOutlet`/`TemplateRef`, or bindings
 * (`[input]`, `(output)`, plain attributes). A template with none of these
 * renders nothing and is dead weight in the source.
 *
 * Only explicitly written `<ng-template>` elements are inspected, recognized
 * by their `tagName === 'ng-template'` — the implicit templates created by
 * structural syntax (`<div *ngIf>`, `<ng-template *ngIf>`) are never
 * reported, since the structural directive is their purpose. A template is
 * reported only when every child is insignificant (whitespace-only text)
 * and none of `#refs`, `let` variables, plain attributes, bound inputs,
 * bound outputs or structural directives is present.
 */
export const rule = ESLintUtils.RuleCreator.withoutDocs({
  name: 'no-useless-empty-ng-template',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow empty ng-template elements without content or template metadata.',
    },
    schema: [],
    messages: {
      uselessEmptyNgTemplate:
        'Remove this empty ng-template; it has no content or template metadata.',
    },
  },
  defaultOptions: [],
  create(context) {
    const parserServices = getTemplateParserServices(context);

    /**
     * Explicit `<ng-template>` elements that are the desugaring target of a
     * structural directive. `*ngIf` on an `<ng-template>` parses as a
     * wrapper `Template` node carrying the directive in `templateAttrs`,
     * whose direct child is the explicit element itself; that child must
     * not be reported, because the structural directive is its metadata.
     * Only direct children of the wrapper are targets — a further nested
     * explicit `<ng-template>` is genuine content and is still inspected.
     * Node identity comes from the very nodes the parser handed to this
     * run, so no `constructor.name` or cross-package `instanceof` is used.
     */
    const structuralTargets = new Set<TmplAstTemplate>();

    return {
      Template(node: TmplAstTemplate) {
        if (node.templateAttrs.length > 0) {
          for (const child of node.children) {
            if ((child as { tagName?: string | null }).tagName === 'ng-template') {
              structuralTargets.add(child as TmplAstTemplate);
            }
          }
          return;
        }

        if (node.tagName !== 'ng-template') {
          return;
        }

        if (structuralTargets.has(node)) {
          return;
        }

        if (
          node.references.length > 0 ||
          node.variables.length > 0 ||
          node.attributes.length > 0 ||
          node.inputs.length > 0 ||
          node.outputs.length > 0
        ) {
          return;
        }

        if (hasSignificantChild(node)) {
          return;
        }

        const loc = parserServices.convertNodeSourceSpanToLoc(
          node.sourceSpan,
        );
        context.report({
          loc,
          messageId: 'uselessEmptyNgTemplate',
        });
      },
    };
  },
});
