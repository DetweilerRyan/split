// Counts a function's cyclomatic complexity from its oxc-parser AST node. These rules are oxCrap's
// own, so they change only when this file does; they're close to ESLint's `complexity` rule but not
// the same. Several are options, all counting by default: `Counting` below. Why is in
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
  /** `each`: every non-default `case` adds a path. `once`: a whole `switch` adds one. */
  switchCases: 'each' | 'once';
  /** `each`: every `&&`, `||` and `??` adds a path. `sequence`: each run of the same one adds one. */
  logicalOperators: 'each' | 'sequence';
  /** Whether a function in a recursion cycle, calling itself or through others, adds a path. */
  recursion: boolean;
  /** Whether each `break` or `continue` to a label adds a path. */
  labelledJumps: boolean;
};

/** Every kind of branching counted: oxCrap's default. */
export const COUNT_ALL: Counting = {
  nestedFunctions: 'enclosing',
  defaultValues: true,
  optionalChaining: true,
  switchCases: 'each',
  logicalOperators: 'each',
  recursion: true,
  labelledJumps: true,
};

/**
 * Each function on its own, with no default values, `?.`, recursion or labelled jumps, and every
 * case and logical operator counted: the counting before #74.
 */
export const COUNT_SEPARATELY: Counting = {
  nestedFunctions: 'own',
  defaultValues: false,
  optionalChaining: false,
  switchCases: 'each',
  logicalOperators: 'each',
  recursion: false,
  labelledJumps: false,
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

function adds(node: AstNode, parent: AstNode | undefined, counting: Counting) {
  if (BRANCHES.has(node.type)) return 1;
  if (node.type === 'SwitchStatement') return counting.switchCases === 'once' ? 1 : 0;
  if (node.type === 'SwitchCase') {
    // `default:` adds no path.
    return counting.switchCases === 'each' && node.test !== null ? 1 : 0;
  }
  if (node.type === 'LogicalExpression') {
    // In `a && b && c` the inner `a && b` continues the outer's run, so a sequence counts once.
    const continues = parent?.type === 'LogicalExpression' && parent.operator === node.operator;
    return counting.logicalOperators === 'each' || !continues ? 1 : 0;
  }
  if ((node.type === 'BreakStatement' || node.type === 'ContinueStatement') && node.label) {
    return counting.labelledJumps ? 1 : 0;
  }
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
  const visit = (node: AstNode, parent: AstNode | undefined) => {
    count += adds(node, parent, counting);
    for (const child of children(node)) if (enters(child)) visit(child, node);
  };
  for (const child of children(fn)) if (enters(child)) visit(child, fn);
  return count;
}

/**
 * The names a function calls, in the code its complexity counts: `f()` gives `f`, and
 * `this.f()` gives `f`, for a method calling another of its class's.
 */
export function calls(fn: AstNode, counting: Counting = COUNT_ALL) {
  const names = new Set<string>();
  const enters = (child: AstNode) =>
    counting.nestedFunctions === 'enclosing' || !FUNCTION_TYPES.has(child.type);
  const visit = (node: AstNode) => {
    if (node.type === 'CallExpression' && isNode(node.callee)) {
      const callee = node.callee;
      if (callee.type === 'Identifier') names.add(callee.name as string);
      if (
        callee.type === 'MemberExpression' &&
        isNode(callee.object) &&
        callee.object.type === 'ThisExpression' &&
        isNode(callee.property) &&
        callee.property.type === 'Identifier'
      ) {
        names.add(callee.property.name as string);
      }
    }
    for (const child of children(node)) if (enters(child)) visit(child);
  };
  for (const child of children(fn)) if (enters(child)) visit(child);
  return names;
}
