import { getTemplateParserServices } from '@angular-eslint/utils';
import {
  PropertyRead,
  RecursiveAstVisitor,
  TmplAstForLoopBlock,
} from '@angular/compiler';
import { ESLintUtils } from '@typescript-eslint/utils';

/**
 * Visits a `@for` track expression AST and flags any read of the bare
 * `$index` loop variable.
 *
 * Detection is purely dispatch-based: the visitor callbacks are invoked by
 * the parsed nodes themselves (each AST node calls the matching visitor
 * method), so the rule never relies on `constructor.name` strings nor on
 * `instanceof` against a particular compiler module copy: the template
 * parser instantiates its own bundled compiler, and node identity checks
 * across copies would silently fail.
 *
 * A `PropertyRead` named `$index` is considered a bare read when its direct
 * receiver dispatches as an `ImplicitReceiver`, i.e. `$index`,
 * `$index + 0` and `$index.toString()` are flagged, anywhere in the track
 * expression, while `item.$index` is not (its receiver is a `PropertyRead`).
 */
class BareIndexDetector extends RecursiveAstVisitor {
  found = false;

  /** Name of the property whose receiver is currently being visited. */
  private receiverOf: string | undefined;

  override visitPropertyRead(ast: PropertyRead, context: unknown): unknown {
    const previous = this.receiverOf;
    this.receiverOf = ast.name;
    const result = super.visitPropertyRead(ast, context);
    this.receiverOf = previous;
    return result;
  }

  override visitImplicitReceiver(): void {
    if (this.receiverOf === '$index') {
      this.found = true;
    }
  }
}

export const rule = ESLintUtils.RuleCreator.withoutDocs({
  name: 'no-index-track',
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow track $index in @for loops.' },
    schema: [],
    messages: {
      indexTrack:
        'Avoid track $index for dynamic collections; track a stable item identity instead.',
    },
  },
  defaultOptions: [],
  create(context) {
    const parserServices = getTemplateParserServices(context);

    return {
      ForLoopBlock(node: TmplAstForLoopBlock) {
        const trackExpression = node.trackBy;
        if (!trackExpression || !trackExpression.ast) {
          return;
        }

        const detector = new BareIndexDetector();
        detector.visit(trackExpression.ast);

        /**
         * Report whenever the track expression reads the bare `$index`
         * variable, directly or in any derived expression.
         */
        if (detector.found) {
          const loc = parserServices.convertNodeSourceSpanToLoc(
            node.sourceSpan,
          );
          context.report({
            loc,
            messageId: 'indexTrack',
          });
        }
      },
    };
  },
});
