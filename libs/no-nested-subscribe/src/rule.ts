import { ESLintUtils, TSESTree, TSESLint } from '@typescript-eslint/utils';

function isRxjsObservable(
  context: Readonly<TSESLint.RuleContext<'nestedSubscribe', []>>,
  node: TSESTree.Expression,
): boolean {
  const services = ESLintUtils.getParserServices(context);
  const checker = services.program.getTypeChecker();
  const type = checker.getTypeAtLocation(
    services.esTreeNodeToTSNodeMap.get(node),
  );
  const subscribeSymbol = checker.getPropertyOfType(type, 'subscribe');
  return (
    subscribeSymbol?.declarations?.some((declaration) =>
      /[\\/]rxjs[\\/]/.test(declaration.getSourceFile().fileName),
    ) ?? false
  );
}

function isAnyType(
  context: Readonly<TSESLint.RuleContext<'nestedSubscribe', []>>,
  node: TSESTree.Expression,
): boolean {
  const services = ESLintUtils.getParserServices(context);
  const checker = services.program.getTypeChecker();
  const type = checker.getTypeAtLocation(
    services.esTreeNodeToTSNodeMap.get(node),
  );
  return checker.typeToString(type) === 'any';
}

/**
 * Recognizes static member access like `subscribe` and `['subscribe']`,
 * but rejects dynamic computed properties such as `obj[key]`.
 */
function getStaticMemberName(
  member: TSESTree.MemberExpression,
): string | undefined {
  if (
    !member.computed &&
    member.property.type === TSESTree.AST_NODE_TYPES.Identifier
  ) {
    return member.property.name;
  }

  if (
    member.computed &&
    member.property.type === TSESTree.AST_NODE_TYPES.Literal &&
    typeof member.property.value === 'string'
  ) {
    return member.property.value;
  }

  return undefined;
}

const OBSERVER_MEMBER_NAMES = ['next', 'error', 'complete'];

function isObserverMemberName(prop: TSESTree.Property): boolean {
  const key = prop.key;
  if (key.type === TSESTree.AST_NODE_TYPES.Identifier) {
    return OBSERVER_MEMBER_NAMES.includes(key.name);
  }
  if (
    key.type === TSESTree.AST_NODE_TYPES.Literal &&
    typeof key.value === 'string'
  ) {
    return OBSERVER_MEMBER_NAMES.includes(key.value);
  }
  return false;
}

/**
 * Resolves a callback argument to the function node that implements it:
 * inline arrow/function expressions are returned as-is; an Identifier is
 * followed through TypeScript services to its VariableDeclaration
 * (arrow/function initializer) or FunctionDeclaration.
 */
function resolveCallbackFunction(
  context: Readonly<TSESLint.RuleContext<'nestedSubscribe', []>>,
  arg: TSESTree.Node,
): TSESTree.Node | undefined {
  if (
    arg.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression ||
    arg.type === TSESTree.AST_NODE_TYPES.FunctionExpression
  ) {
    return arg;
  }

  if (arg.type !== TSESTree.AST_NODE_TYPES.Identifier) {
    return undefined;
  }

  const services = ESLintUtils.getParserServices(context);
  const checker = services.program.getTypeChecker();
  const symbol = checker.getSymbolAtLocation(
    services.esTreeNodeToTSNodeMap.get(arg),
  );
  const declaration = symbol?.valueDeclaration;
  if (!declaration) {
    return undefined;
  }

  const estreeNode = services.tsNodeToESTreeNodeMap.get(declaration);
  if (!estreeNode) {
    return undefined;
  }

  if (estreeNode.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration) {
    return estreeNode;
  }

  if (
    estreeNode.type === TSESTree.AST_NODE_TYPES.VariableDeclarator &&
    estreeNode.init
  ) {
    const initializer = estreeNode.init;
    if (
      initializer.type ===
        TSESTree.AST_NODE_TYPES.ArrowFunctionExpression ||
      initializer.type === TSESTree.AST_NODE_TYPES.FunctionExpression
    ) {
      return initializer;
    }
  }

  return undefined;
}

export const rule = ESLintUtils.RuleCreator.withoutDocs({
  name: 'no-nested-subscribe',
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow subscribe inside subscribe.' },
    schema: [],
    messages: {
      nestedSubscribe:
        'Do not subscribe inside subscribe; use a higher-order mapping operator instead.',
    },
  },
  defaultOptions: [],
  create(context) {
    // Track callback nodes that are arguments to verified RxJS subscribe() calls
    const subscribeCallbacks = new WeakSet<TSESTree.Node>();
    // Subscribe calls on RxJS observables, collected for a second pass
    const verifiedSubscribeCalls: TSESTree.CallExpression[] = [];
    // Subscribe calls on `any`-typed objects, only reported when already nested
    const ambiguousSubscribeCalls: TSESTree.CallExpression[] = [];

    function registerCallbacks(node: TSESTree.CallExpression) {
      for (const arg of node.arguments) {
        const resolved = resolveCallbackFunction(context, arg);
        if (resolved) {
          subscribeCallbacks.add(resolved);
        } else if (arg.type === TSESTree.AST_NODE_TYPES.ObjectExpression) {
          for (const prop of arg.properties) {
            if (
              prop.type === TSESTree.AST_NODE_TYPES.Property &&
              isObserverMemberName(prop) &&
              (prop.value.type ===
                TSESTree.AST_NODE_TYPES.ArrowFunctionExpression ||
                prop.value.type ===
                  TSESTree.AST_NODE_TYPES.FunctionExpression)
            ) {
              subscribeCallbacks.add(prop.value);
            }
          }
        }
      }
    }

    function isInsideSubscribeCallback(node: TSESTree.Node): boolean {
      let current: TSESTree.Node | undefined = node.parent;
      while (current) {
        if (subscribeCallbacks.has(current)) {
          return true;
        }
        current = current.parent;
      }
      return false;
    }

    function reportNested(node: TSESTree.CallExpression) {
      context.report({
        node,
        messageId: 'nestedSubscribe',
      });
    }

    return {
      CallExpression(node) {
        // Check if this is a subscribe() call on an RxJS Observable
        if (
          node.callee.type !== TSESTree.AST_NODE_TYPES.MemberExpression ||
          getStaticMemberName(node.callee) !== 'subscribe'
        ) {
          return;
        }

        const object = node.callee.object;
        if (isRxjsObservable(context, object)) {
          verifiedSubscribeCalls.push(node);
        } else if (isAnyType(context, object)) {
          /**
           * Unknown receiver: remember the call so it can be reported only
           * when it is already nested inside an identified callback. A bare
           * `any` object is not assumed to be an Observable.
           */
          ambiguousSubscribeCalls.push(node);
        }
      },
      /**
       * Register callbacks and report after the full traversal so that named
       * callbacks (declared before or after their subscribe call) are known
       * regardless of source order.
       */
      'Program:exit'() {
        for (const call of verifiedSubscribeCalls) {
          registerCallbacks(call);
        }
        for (const call of verifiedSubscribeCalls) {
          if (isInsideSubscribeCallback(call)) {
            reportNested(call);
          }
        }
        for (const call of ambiguousSubscribeCalls) {
          if (isInsideSubscribeCallback(call)) {
            reportNested(call);
          }
        }
      },
    };
  },
});
