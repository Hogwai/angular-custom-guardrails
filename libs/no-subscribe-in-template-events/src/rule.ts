import { ESLintUtils, TSESLint } from '@typescript-eslint/utils';
import {
  AST,
  ASTWithSource,
  Call,
  PropertyRead,
  RecursiveAstVisitor,
  SafeCall,
  SafePropertyRead,
  TmplAstBoundEvent,
} from '@angular/compiler';

/**
 * A call expression node (`Call` or `SafeCall`) as dispatched by the
 * template parser, which attaches an ESLint-compatible `loc` to every
 * visited node.
 */
type SubscribeCallNode = (Call | SafeCall) & {
  loc: TSESLint.AST.SourceLocation;
};

/**
 * Non-recursive probe: dispatches a single expression node and records what
 * that node is — a member access named exactly `subscribe` (`PropertyRead`
 * or `SafePropertyRead`) or an `ImplicitReceiver`. The node itself invokes
 * the matching visitor method (`node.visit(probe)`), so the probe never
 * relies on `constructor.name` strings nor on `instanceof` against a
 * particular compiler module copy: the template parser instantiates its own
 * bundled compiler, and node identity checks across copies would silently
 * fail.
 *
 * Only the outermost dispatch may answer: `visit` tracks the dispatch depth
 * and the recorded answers are ignored below it, so probing a node never
 * descends into its children — without the guard, `RecursiveAstVisitor`
 * would walk down a member chain and report the implicit receiver at its
 * root, or report a `subscribe` that is merely read (e.g. as the receiver
 * of another member access, or as an argument of an inner call) instead of
 * being called.
 */
class ReceiverProbe extends RecursiveAstVisitor {
  /** The probed member access when it is named exactly `subscribe`. */
  subscribeMember: PropertyRead | SafePropertyRead | undefined;

  /** Set when the probed node is an implicit receiver (a bare identifier). */
  isImplicit = false;

  /** Dispatch depth of the current probe (1 at the outermost dispatch). */
  private dispatchDepth = 0;

  reset(): void {
    this.subscribeMember = undefined;
    this.isImplicit = false;
  }

  override visit(ast: AST, context?: unknown): unknown {
    this.dispatchDepth++;
    try {
      return ast.visit(this, context);
    } finally {
      this.dispatchDepth--;
    }
  }

  override visitPropertyRead(ast: PropertyRead): void {
    if (this.dispatchDepth === 1 && ast.name === 'subscribe') {
      this.subscribeMember = ast;
    }
  }

  override visitSafePropertyRead(ast: SafePropertyRead): void {
    if (this.dispatchDepth === 1 && ast.name === 'subscribe') {
      this.subscribeMember = ast;
    }
  }

  override visitImplicitReceiver(): void {
    if (this.dispatchDepth === 1) {
      this.isImplicit = true;
    }
  }
}

/**
 * Walks an event handler expression and collects every member call whose
 * method name is exactly `subscribe`: `users$.subscribe()`,
 * `users$?.subscribe()`, `users$.subscribe?.()`,
 * `this.users$.subscribe(...)`, `service.users$.subscribe(...)`, or any
 * `subscribe` member call nested inside another call. A bare `subscribe()`
 * call — whose member access wraps an implicit receiver — is never
 * collected: without a receiver it may well be a business action on the
 * component. A `subscribe` that is only read, never called, is never
 * collected either.
 *
 * The walk is dispatch-driven: `RecursiveAstVisitor` lets every parsed
 * expression node invoke the matching visitor callback itself, so the
 * detector never relies on `constructor.name` strings nor on `instanceof`
 * against a particular compiler module copy.
 */
class SubscribeCallDetector extends RecursiveAstVisitor {
  /** Member calls on `subscribe` found in the handled expression. */
  found: SubscribeCallNode[] = [];

  /** Reusable probe classifying single expression nodes. */
  private readonly probe = new ReceiverProbe();

  /**
   * Inspects the callee of a call: for `users$.subscribe()` and
   * `users$?.subscribe()` the receiver is a member access (`PropertyRead`
   * or `SafePropertyRead`) named `subscribe`; for a bare `subscribe()` call
   * the same member access wraps an implicit receiver. Only a real receiver
   * (an observable, `this`, ...) makes the call a member call worth
   * flagging. Because the probe answers only for the outermost dispatch,
   * the callee itself must be the `subscribe` member access: a `subscribe`
   * that is merely read — `stream.subscribe?.other()` or
   * `factory(stream.subscribe)()` — is never reported.
   */
  private inspectCall(ast: Call | SafeCall): void {
    this.probe.reset();
    this.probe.visit(ast.receiver);
    const member = this.probe.subscribeMember;
    if (member === undefined) {
      return;
    }
    this.probe.reset();
    this.probe.visit(member.receiver);
    if (!this.probe.isImplicit) {
      this.found.push(ast as SubscribeCallNode);
    }
  }

  override visitCall(ast: Call, context: unknown): unknown {
    this.inspectCall(ast);
    return super.visitCall(ast, context);
  }

  override visitSafeCall(ast: SafeCall, context: unknown): unknown {
    this.inspectCall(ast);
    return super.visitSafeCall(ast, context);
  }
}

/**
 * ESLint rule for Angular templates: disallows calling `subscribe` on an
 * observable inside a template event handler (`(click)="..."`, ...).
 *
 * Subscribing inside an event handler starts a subscription with no
 * lifecycle tied to the view: every event fires a new subscription that is
 * never unsubscribed, leaking connections and risking stale emissions.
 * Delegate the operation to the component instead, which owns the
 * subscription lifecycle.
 *
 * Only the expressions of Angular event bindings (`BoundEvent`, e.g.
 * `(click)="..."`) are inspected. Interpolations, property bindings,
 * attribute bindings and any other template expression are never visited.
 * Inside a handler, every member call whose method name is exactly
 * `subscribe` is reported, at any nesting depth, including safe-navigation
 * variants (`users$?.subscribe()`, `users$.subscribe?.()`). A bare
 * `subscribe()` call without a receiver is not reported: without a
 * receiver it may be a business action on the component. A `subscribe`
 * that is only read, never called (`stream.subscribe?.other()`,
 * `factory(stream.subscribe)()`), is not reported either.
 *
 * The rule is configuration-free: it always inspects every event handler.
 */
export const rule = ESLintUtils.RuleCreator.withoutDocs({
  name: 'no-subscribe-in-template-events',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow calling subscribe on an observable inside a template event handler.',
    },
    schema: [],
    messages: {
      subscribeInTemplateEvent:
        'Do not subscribe inside a template event handler; delegate the operation to the component.',
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      /**
       * Inspect every Angular event binding (`(click)="..."`, ...). The
       * handler is an `ASTWithSource` whose `ast` is the parsed expression
       * tree; the public type only declares `handler: AST`, so narrow it
       * through a cast. A handler without an expression is skipped.
       */
      BoundEvent(node: TmplAstBoundEvent) {
        const handler = node.handler as ASTWithSource | null;
        if (!handler || !handler.ast) {
          return;
        }
        const detector = new SubscribeCallDetector();
        detector.visit(handler.ast);
        for (const call of detector.found) {
          context.report({
            loc: call.loc,
            messageId: 'subscribeInTemplateEvent',
          });
        }
      },
    };
  },
});
