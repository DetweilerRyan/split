// Counts a function's cyclomatic complexity from its oxc-parser AST node. These rules are this
// repository's own, so they change only when this file does; they're close to ESLint's
// `complexity` rule but not the same. Why is in crap.meta.md beside this file.

/** An oxc-parser AST node: ESTree-shaped, with UTF-16 `start` and `end` offsets. */
export type AstNode = { type: string; start: number; end: number; [key: string]: unknown };

export const isNode = (value: unknown): value is AstNode =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { type?: unknown }).type === 'string';

/** A function's own node types; a nested one is scored separately. */
export const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

/** Node types that each add one path through a function, beyond the one it starts with. */
const BRANCHES = new Set([
  'IfStatement',
  'ConditionalExpression',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'CatchClause',
  'LogicalExpression', // &&, || and ??
]);
const LOGICAL_ASSIGNMENTS = new Set(['&&=', '||=', '??=']);

/** The child nodes of `node`, in source order. */
export function children(node: AstNode): AstNode[] {
  const found: AstNode[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === 'type' || key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) found.push(item);
    } else if (isNode(value)) {
      found.push(value);
    }
  }
  return found;
}

function adds(node: AstNode) {
  if (BRANCHES.has(node.type)) return 1;
  if (node.type === 'SwitchCase') return node.test === null ? 0 : 1; // `default:` adds no path
  if (node.type === 'AssignmentExpression') {
    return LOGICAL_ASSIGNMENTS.has(node.operator as string) ? 1 : 0;
  }
  return 0;
}

/** 1, plus one for each branch in the function's own body and parameters, not nested functions'. */
export function complexity(fn: AstNode) {
  let count = 1;
  const visit = (node: AstNode) => {
    count += adds(node);
    for (const child of children(node)) if (!FUNCTION_TYPES.has(child.type)) visit(child);
  };
  for (const child of children(fn)) if (!FUNCTION_TYPES.has(child.type)) visit(child);
  return count;
}
