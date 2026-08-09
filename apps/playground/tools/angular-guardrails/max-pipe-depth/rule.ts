import { ESLintUtils, TSESTree, TSESLint } from '@typescript-eslint/utils';
import * as ts from 'typescript';

type Options = [{ max?: number }];

/**
 * Local helper (not shared with other rules): resolves the statically known
 * member name of a call callee. Recognizes `obj.pipe` and `obj['pipe']`, but
 * deliberately not a dynamically computed property such as `obj[key]`.
 */
function getStaticMemberName(
  callee: TSESTree.CallExpression['callee'],
): string | undefined {
  if (callee.type === TSESTree.AST_NODE_TYPES.MemberExpression) {
    if (!callee.computed) {
      return callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
        ? callee.property.name
        : undefined;
    }
    if (
      callee.property.type === TSESTree.AST_NODE_TYPES.Literal &&
      callee.property.value === 'pipe'
    ) {
      return 'pipe';
    }
    // Dynamically computed member: the called form is not statically `pipe`.
    return undefined;
  }
  if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) {
    return callee.name;
  }
  return undefined;
}

function isRxjsObservable(checker: ts.TypeChecker, type: ts.Type): boolean {
  return ['pipe', 'subscribe'].every((name) => {
    const symbol = checker.getPropertyOfType(type, name);
    return symbol?.declarations?.some((declaration) =>
      /[\\/]rxjs[\\/]/.test(declaration.getSourceFile().fileName),
    );
  });
}

/**
 * Strict policy for `any`/`unknown`: when the invoked form is clearly `pipe`
 * and exceeds the max, report instead of ignoring it. Known non-RxJS object
 * types are never reported. An undeclared identifier (implicit `any`, e.g.
 * `obj.pipe(...)`) does not resolve to the canonical `any` type, so it stays
 * silent; this preserves the "unknown non-RxJS object" valid case.
 */
function isAnyOrUnknown(checker: ts.TypeChecker, type: ts.Type): boolean {
  return (
    type === checker.getAnyType() || (type.flags & ts.TypeFlags.Unknown) !== 0
  );
}

/**
 * Resolves the source expression a `pipe` call operates on:
 * - member access (`source$.pipe`, `source$['pipe']`) → the object expression
 * - a bare `pipe(...)` identifier → the initializer of the variable it was
 *   destructured from via an ObjectPattern (`const { pipe } = source$;`)
 *
 * Returns undefined when the call is out of scope, e.g.
 * `Observable.prototype.pipe.call(...)` (callee is not a member access on the
 * observable itself, and `getStaticMemberName` on a non-expression callee
 * yields nothing usable).
 */
function getSourceNode(
  context: Readonly<TSESLint.RuleContext<'tooDeep', Options>>,
  callee: TSESTree.CallExpression['callee'],
): ts.Node | undefined {
  const services = ESLintUtils.getParserServices(context);
  if (callee.type === TSESTree.AST_NODE_TYPES.MemberExpression) {
    return services.esTreeNodeToTSNodeMap.get(callee.object);
  }
  if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) {
    const checker = services.program.getTypeChecker();
    const symbol = checker.getSymbolAtLocation(
      services.esTreeNodeToTSNodeMap.get(callee),
    );
    for (const declaration of symbol?.declarations ?? []) {
      if (
        ts.isBindingElement(declaration) &&
        ts.isObjectBindingPattern(declaration.parent) &&
        ts.isVariableDeclaration(declaration.parent.parent) &&
        declaration.parent.parent.initializer
      ) {
        if (declaration.dotDotDotToken !== undefined) {
          continue;
        }
        /**
         * Only resolve when the destructured property is actually `pipe`:
         * `const { subscribe: pipe } = source$` binds a different property
         * and must not be treated as a pipe call.
         */
        const propertyName = declaration.propertyName;
        if (
          propertyName !== undefined &&
          (!ts.isIdentifier(propertyName) || propertyName.text !== 'pipe')
        ) {
          continue;
        }
        return declaration.parent.parent.initializer;
      }
    }
  }
  return undefined;
}

export const rule = ESLintUtils.RuleCreator.withoutDocs({
  name: 'max-pipe-depth',
  meta: {
    type: 'suggestion',
    docs: { description: 'Limit RxJS pipe operator count.' },
    schema: [
      {
        type: 'object',
        properties: { max: { type: 'integer', minimum: 1 } },
        additionalProperties: false,
      },
    ],
    messages: {
      tooDeep:
        'RxJS pipe has {{actual}} operators; the configured maximum is {{max}}.',
    },
  },
  defaultOptions: [{ max: 3 }] as Options,
  create(context) {
    const max = context.options[0]?.max ?? 3;
    return {
      CallExpression(node) {
        const memberName = getStaticMemberName(node.callee);
        if (memberName !== 'pipe' || node.arguments.length <= max) {
          return;
        }
        const services = ESLintUtils.getParserServices(context);
        const sourceNode = getSourceNode(context, node.callee);
        if (!sourceNode) {
          return;
        }
        const checker = services.program.getTypeChecker();
        const type = checker.getTypeAtLocation(sourceNode);
        if (!isRxjsObservable(checker, type) && !isAnyOrUnknown(checker, type)) {
          return;
        }
        context.report({
          node,
          messageId: 'tooDeep',
          data: {
            actual: String(node.arguments.length),
            max: String(max),
          },
        });
      },
    };
  },
});
