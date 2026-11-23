// Counts a function's cyclomatic complexity from its oxc-parser AST node. These rules are oxCrap's
// own, so they change only when this file does; they're close to ESLint's `complexity` rule but not
// the same. Several are options, all counting by default: `Counting` below. Why is in
// oxcrap.meta.md beside this file.

/** An oxc-parser AST node: ESTree-shaped, with UTF-16 `start` and `end` offsets. */
export type AstNode = { type: string; start: number; end: number; [key: string]: unknown };

export function isNode(value: unknown): value is AstNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

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

/** How many paths a node adds, under `counting`. */
// @crap-allow CRAP 21, complexity 21. One dispatch over the node types that add paths, each case a line; splitting it, or moving it into a lookup table, would only hide the branches.
function adds(node: AstNode, parent: AstNode | undefined, counting: Counting) {
  if (BRANCHES.has(node.type)) return 1;
  switch (node.type) {
    case 'SwitchStatement':
      // Once for the whole switch, if it has a case beyond `default:`, which adds no path.
      return counting.switchCases === 'once' && hasCase(node) ? 1 : 0;
    case 'SwitchCase':
      // `default:` adds no path.
      return counting.switchCases === 'each' && node.test !== null ? 1 : 0;
    case 'LogicalExpression':
      return logicalAdds(node, parent, counting);
    case 'BreakStatement':
    case 'ContinueStatement':
      return counting.labelledJumps && node.label ? 1 : 0;
    case 'AssignmentExpression':
      // `&&=`, `||=` and `??=`.
      return LOGICAL_ASSIGNMENTS.has(node.operator as string) ? 1 : 0;
    case 'AssignmentPattern':
      // `x = 1` as a parameter, or `{ x = 1 }` and `[x = 1]` in destructuring.
      return counting.defaultValues ? 1 : 0;
    case 'MemberExpression':
    case 'CallExpression':
      // `a?.b` and `f?.()`; a TypeScript optional parameter, `x?: number`, is an Identifier.
      return counting.optionalChaining && node.optional === true ? 1 : 0;
    default:
      return 0;
  }
}

/** Whether a switch has a case beyond `default:`. */
function hasCase(node: AstNode) {
  const cases = (node.cases as AstNode[] | undefined) ?? [];
  return cases.some((c) => c.test !== null);
}

/**
 * What a logical operator adds: 1 each, or with `sequence`, the outermost operator of an
 * expression counts its runs, in source order, and the rest add 0.
 */
function logicalAdds(node: AstNode, parent: AstNode | undefined, counting: Counting) {
  if (counting.logicalOperators === 'each') return 1;
  return parent?.type === 'LogicalExpression' ? 0 : operatorRuns(node);
}

/**
 * The runs of the same operator in a logical expression, in source order, looking through
 * parentheses: `a && b && c` is one, `a && b || c` two, and `a || b && c || d` three.
 */
function operatorRuns(node: AstNode) {
  const operators: string[] = [];
  function walk(n: unknown) {
    if (!isNode(n)) return;
    if (n.type === 'ParenthesizedExpression') walk(n.expression);
    else if (n.type === 'LogicalExpression') {
      walk(n.left);
      operators.push(n.operator as string);
      walk(n.right);
    }
  }
  walk(node);
  return operators.filter((op, i) => i === 0 || operators[i - 1] !== op).length;
}

/**
 * 1, plus one for each branch in the function's body and parameters. A nested function's branches
 * count too when `counting.nestedFunctions` is `enclosing`, and not when it's `own`.
 */
export function complexity(fn: AstNode, counting: Counting = COUNT_ALL) {
  let count = 1;
  function enters(child: AstNode) {
    return counting.nestedFunctions === 'enclosing' || !FUNCTION_TYPES.has(child.type);
  }
  function visit(node: AstNode, parent: AstNode | undefined) {
    count += adds(node, parent, counting);
    // Parentheses don't break a run of operators, so a child of them sees what's outside them.
    const own = node.type === 'ParenthesizedExpression' ? parent : node;
    for (const child of children(node)) if (enters(child)) visit(child, own);
  }
  for (const child of children(fn)) if (enters(child)) visit(child, fn);
  return count;
}
