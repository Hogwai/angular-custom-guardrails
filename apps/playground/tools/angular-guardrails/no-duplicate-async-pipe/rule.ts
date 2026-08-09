import { ESLintUtils, TSESLint } from '@typescript-eslint/utils';
import type {
  AbsoluteSourceSpan,
  BindingPipe,
  ParseSourceSpan,
  TmplAstDeferredBlock,
  TmplAstDeferredBlockError,
  TmplAstDeferredBlockLoading,
  TmplAstDeferredBlockPlaceholder,
  TmplAstForLoopBlock,
  TmplAstForLoopBlockEmpty,
  TmplAstIfBlockBranch,
  TmplAstNode,
  TmplAstSwitchBlockCaseGroup,
  TmplAstTemplate,
} from '@angular/compiler';

/**
 * A `BindingPipe` expression node as dispatched by the template parser, which
 * attaches an ESLint-compatible `loc` to every visited node.
 */
type PipeNode = BindingPipe & { loc: TSESLint.AST.SourceLocation };

/** Source spans come in two families: expressions and template nodes. */
type SourceSpan = AbsoluteSourceSpan | ParseSourceSpan;

/**
 * Extracts absolute character offsets from either an expression span
 * (`AbsoluteSourceSpan`, numeric `start`/`end`) or a template span
 * (`ParseSourceSpan`, `start`/`end` locations carrying offsets). Both come
 * from the compiler, but they are inspected through plain property reads
 * only, so the rule never relies on `constructor.name` strings nor on
 * `instanceof` against a particular compiler module copy: the template
 * parser instantiates its own bundled compiler, and node identity checks
 * across copies would silently fail.
 */
function getSpanOffsets(span: SourceSpan): [number, number] {
  const start = typeof span.start === 'number' ? span.start : span.start.offset;
  const end = typeof span.end === 'number' ? span.end : span.end.offset;
  return [start, end];
}

function isQuote(ch: string): boolean {
  return ch === "'" || ch === '"' || ch === '`';
}

/**
 * Removes balanced parentheses that wrap the entire expression, repeatedly:
 * `(user$)`, `((user$))` and `( user$ )` all reduce to `user$`. Parentheses
 * that only wrap a sub-expression (`(a + b) * c`) are kept. The scan is
 * quote-aware so parentheses inside string literals never affect the
 * balance.
 */
function stripOuterParens(text: string): string {
  let first = 0;
  while (first < text.length && /\s/.test(text[first])) {
    first++;
  }
  if (text[first] !== '(') {
    return text;
  }
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;
  for (let i = first; i < text.length; i++) {
    const ch = text[i];
    if (quote !== null) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (isQuote(ch)) {
      quote = ch;
      continue;
    }
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0) {
        // Only strip when the closing parenthesis is the last non-space
        // character, i.e. the parentheses wrap the whole expression.
        if (text.slice(i + 1).trim() !== '') {
          return text;
        }
        return stripOuterParens(text.slice(first + 1, i));
      }
    }
  }
  return text;
}

/**
 * Builds a canonical key for a pipe input expression: the source text of the
 * expression span, with balanced outer parentheses removed and with
 * whitespace outside string literals dropped. Whitespace inside string
 * literals is preserved, so `'a b'` and `'a  b'` stay distinct expressions.
 */
function buildExpressionKey(expSource: string): string {
  const text = stripOuterParens(expSource);
  let key = '';
  let quote: string | null = null;
  let escaped = false;
  for (const ch of text) {
    if (quote !== null) {
      key += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (isQuote(ch)) {
      quote = ch;
      key += ch;
      continue;
    }
    if (!/\s/.test(ch)) {
      key += ch;
    }
  }
  return key;
}

/**
 * Computes the absolute bounds of an embedded scope from the spans of the
 * embedded view children only. The header of the block (`@if (cond)`,
 * `@for (...; track ...)`, `@switch (expr)`, `@defer (when ...)`,
 * `<ng-template [input]="...">`) lies outside these bounds, so pipes in
 * header expressions belong to the parent scope. Returns `undefined` when
 * the embedded view has no children (e.g. an empty `@if` body).
 */
function getChildrenBounds(
  children: readonly TmplAstNode[],
): [number, number] | undefined {
  let min: number | undefined;
  let max: number | undefined;
  for (const child of children) {
    const [start, end] = getSpanOffsets(child.sourceSpan);
    if (min === undefined || start < min) {
      min = start;
    }
    if (max === undefined || end > max) {
      max = end;
    }
  }
  if (min === undefined || max === undefined) {
    return undefined;
  }
  return [min, max];
}

/**
 * ESLint rule for Angular templates: flags every `async` pipe whose input
 * expression is already piped with `async` earlier in the same template
 * scope.
 *
 * Two `{{ user$ | async }}` interpolations subscribe to the same observable
 * twice; each occurrence spawns its own subscription with its own lifecycle.
 * Aliasing the result once (`@let value = user$ | async;` or a `*ngIf="... |
 * async as ..."`) avoids the double subscription.
 *
 * Equivalence: two occurrences are duplicates when their input expressions
 * (`BindingPipe.exp`) are equivalent — compared by source text with balanced
 * outer parentheses removed and whitespace outside string literals ignored.
 * The pipe arguments and the spacing around `| async` never matter.
 *
 * Scope handling: every embedded view opens its own scope, whose bounds are
 * derived from the view children only (`@if`/`@else` branch bodies, `@for`
 * main and `@empty` bodies, `@switch` case bodies, `@defer` bodies,
 * `ng-template` bodies). Header expressions of a block (branch condition,
 * loop expression/track, switch expression, defer triggers, template input
 * bindings) belong to the parent scope: a pipe in `@if (user$ | async)` and
 * a pipe in the branch body are never compared, while a pipe in the
 * condition is compared with pipes around the block. Scopes stay independent
 * between branches.
 *
 * The rule is configuration-free: it always inspects every `async` pipe.
 */
export const rule = ESLintUtils.RuleCreator.withoutDocs({
  name: 'no-duplicate-async-pipe',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow subscribing to the same observable with the async pipe more than once within a template scope.',
    },
    schema: [],
    messages: {
      duplicateAsyncPipe:
        'Avoid subscribing to the same observable with async multiple times; alias the result instead.',
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceText = context.sourceCode.getText();

    // Absolute bounds of every embedded scope opened so far, in traversal
    // order. A nested scope is always opened after its parent, so the last
    // scope containing a pipe is its innermost one.
    const scopes: [number, number][] = [];

    // `async` pipes of interest, tagged with their innermost scope (an index
    // into `scopes`, or -1 for the root template scope).
    const pipes: {
      pipe: PipeNode;
      scope: number;
      start: number;
      end: number;
    }[] = [];

    const openScope = (children: readonly TmplAstNode[]): void => {
      const bounds = getChildrenBounds(children);
      if (bounds !== undefined) {
        scopes.push(bounds);
      }
    };

    return {
      IfBlockBranch(node: TmplAstIfBlockBranch) {
        openScope(node.children);
      },
      ForLoopBlock(node: TmplAstForLoopBlock) {
        openScope(node.children);
      },
      ForLoopBlockEmpty(node: TmplAstForLoopBlockEmpty) {
        openScope(node.children);
      },
      SwitchBlockCaseGroup(node: TmplAstSwitchBlockCaseGroup) {
        openScope(node.children);
      },
      Template(node: TmplAstTemplate) {
        openScope(node.children);
      },
      DeferredBlock(node: TmplAstDeferredBlock) {
        openScope(node.children);
      },
      DeferredBlockLoading(node: TmplAstDeferredBlockLoading) {
        openScope(node.children);
      },
      DeferredBlockError(node: TmplAstDeferredBlockError) {
        openScope(node.children);
      },
      DeferredBlockPlaceholder(node: TmplAstDeferredBlockPlaceholder) {
        openScope(node.children);
      },
      BindingPipe(node: PipeNode) {
        if (node.name !== 'async' || !node.exp) {
          return;
        }
        const [start, end] = getSpanOffsets(node.sourceSpan);
        let scope = -1;
        for (let i = 0; i < scopes.length; i++) {
          if (scopes[i][0] <= start && end <= scopes[i][1]) {
            scope = i;
          }
        }
        pipes.push({ pipe: node, scope, start, end });
      },
      'Program:exit'() {
        // Report occurrences in source order, so that the first occurrence of
        // a given input expression stays clean and every later one is
        // flagged.
        pipes.sort((a, b) => a.start - b.start || a.end - b.end);
        const seenPerScope = new Map<number, Map<string, PipeNode>>();
        for (const entry of pipes) {
          const [expStart, expEnd] = getSpanOffsets(
            entry.pipe.exp.sourceSpan,
          );
          const key = buildExpressionKey(
            sourceText.slice(expStart, expEnd),
          );
          let seen = seenPerScope.get(entry.scope);
          if (seen === undefined) {
            seen = new Map();
            seenPerScope.set(entry.scope, seen);
          }
          if (seen.has(key)) {
            context.report({
              loc: entry.pipe.loc,
              messageId: 'duplicateAsyncPipe',
            });
          } else {
            seen.set(key, entry.pipe);
          }
        }
      },
    };
  },
});
