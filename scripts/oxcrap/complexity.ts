// Counts a function's cyclomatic complexity from its oxc-parser AST node. These rules are oxCrap's
// own, so they change only when this file does; they're close to ESLint's `complexity` rule but not
// the same. Three of them are options, all on by default: `Counting` below. Why is in
// oxcrap.meta.md beside this file.

/** An oxc-parser AST node: ESTree-shaped, with UTF-16 `start` and `end` offsets. */
export type AstNode = { type: string; start: number; end: number; [key: string]: unknown };

export const isNode = (value: unknown): value is AstNode =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { type?: unknown }).type === 'string';

/** A function's own node types. A nested one is scored separately only with `own` counting. */
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
/** Node types an optional link, `?.`, can mark. */
const OPTIONAL_LINKS = new Set(['MemberExpression', 'CallExpression']);

/** What counts beyond the fixed branches. Each is on by default. */
export type Counting = {
  /** `enclosing`: a function's nested functions count towards it. `own`: each is scored alone. */
  nestedFunctions: 'enclosing' | 'own';
  /** Whether each default value, in a parameter or in destructuring, adds a path. */
  defaultValues: boolean;
  /** Whether each optional link, `?.`, adds a path. */
  optionalChaining: boolean;
};

/** Every kind of branching counted: oxCrap's default. */
export const COUNT_ALL: Counting = {
  nestedFunctions: 'enclosing',
  defaultValues: true,
  optionalChaining: true,
};

/** Each function on its own, with no default values or `?.`: the counting before #74. */
export const COUNT_SEPARATELY: Counting = {
  nestedFunctions: 'own',
  defaultValues: false,
  optionalChaining: false,
};

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

function adds(node: AstNode, counting: Counting) {
  if (BRANCHES.has(node.type)) return 1;
  if (node.type === 'SwitchCase') return node.test === null ? 0 : 1; // `default:` adds no path
  if (node.type === 'AssignmentExpression') {
    return LOGICAL_ASSIGNMENTS.has(node.operator as string) ? 1 : 0;
  }
  // `x = 1` as a parameter, or `{ x = 1 }` and `[x = 1]` in destructuring.
  if (node.type === 'AssignmentPattern') return counting.defaultValues ? 1 : 0;
  // `a?.b` and `f?.()`; a TypeScript optional parameter, `x?: number`, is an Identifier, not these.
  if (OPTIONAL_LINKS.has(node.type) && node.optional === true) {
    return counting.optionalChaining ? 1 : 0;
  }
  return 0;
}

/**
 * 1, plus one for each branch in the function's body and parameters. A nested function's branches
 * count too when `counting.nestedFunctions` is `enclosing`, and not when it's `own`.
 */
export function complexity(fn: AstNode, counting: Counting = COUNT_ALL) {
  let count = 1;
  const enters = (child: AstNode) =>
    counting.nestedFunctions === 'enclosing' || !FUNCTION_TYPES.has(child.type);
  const visit = (node: AstNode) => {
    count += adds(node, counting);
    for (const child of children(node)) if (enters(child)) visit(child);
  };
  for (const child of children(fn)) if (enters(child)) visit(child);
  return count;
}
