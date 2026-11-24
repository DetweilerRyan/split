// Counts a function's cyclomatic complexity from its oxc-parser AST node. These rules are oxCrap's
// own, so they change only when this file does; they're close to ESLint's `complexity` rule but not
// the same. Several are options, all counting by default: `Counting` below. Why is in
// oxcrap.meta.md beside this file.

/** An oxc-parser AST node: ESTree-shaped, with UTF-16 `start` and `end` offsets. */
export type AstNode = {
  readonly type: string;
  readonly start: number;
  readonly end: number;
  readonly [key: string]: unknown;
};

export function isNode(value: unknown): value is AstNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { readonly type?: unknown }).type === 'string'
  );
}

/** Whether a node type is a function's. A nested one is scored separately only with `own` counting. */
export function isFunctionType(type: string) {
  switch (type) {
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return true;
    default:
      return false;
  }
}

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
  readonly nestedFunctions: 'enclosing' | 'own';
  /** Whether each default value, in a parameter or in destructuring, adds a path. */
  readonly defaultValues: boolean;
  /** Whether each optional link, `?.`, adds a path. */
  readonly optionalChaining: boolean;
  /** `each`: every non-default `case` adds a path. `once`: a whole `switch` adds one. */
  readonly switchCases: 'each' | 'once';
  /** `each`: every `&&`, `||` and `??` adds a path. `sequence`: each run of the same one adds one. */
  readonly logicalOperators: 'each' | 'sequence';
  /** Whether a function in a recursion cycle, calling itself or through others, adds a path. */
  readonly recursion: boolean;
  /** Whether each `break` or `continue` to a label adds a path. */
  readonly labelledJumps: boolean;
  /**
   * Whether reading a static lookup table adds the paths it stands for: a dispatch table, holding
   * functions, as a switch; `.has`, `.includes` and `in` as an `||` chain. tables.ts says how.
   */
  readonly lookupTables: boolean;
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
  lookupTables: true,
};

/**
 * Each function on its own, with no default values, `?.`, recursion, labelled jumps or lookup
 * tables, and every case and logical operator counted: the counting before #74.
 */
export const COUNT_SEPARATELY: Counting = {
  nestedFunctions: 'own',
  defaultValues: false,
  optionalChaining: false,
  switchCases: 'each',
  logicalOperators: 'each',
  recursion: false,
  labelledJumps: false,
  lookupTables: false,
};

/** The child nodes of `node`, in source order. */
export function children(node: AstNode): readonly AstNode[] {
  return Object.values(node).flatMap(nodesIn);
}

/** The nodes one property of a node holds: those in its array, or the value if it's a node. */
function nodesIn(value: unknown): readonly AstNode[] {
  if (Array.isArray(value)) return value.filter(isNode);
  return isNode(value) ? [value] : [];
}

/** How many paths a node adds, under `counting`. */
// @crap-allow CRAP 32, complexity 32. One dispatch over the node types that add paths, each case a line: splitting it would scatter one idea, and a lookup table would count its cases the same (#82).
function adds(node: AstNode, parent: AstNode, counting: Counting) {
  if (BRANCHES.has(node.type)) return 1;
  switch (node.type) {
    case 'SwitchStatement':
      // Once for the whole switch, if it has a case beyond `default:`, which adds no path.
      return counting.switchCases === 'once' &&
        (node.cases as readonly AstNode[]).some((c) => c.test !== null)
        ? 1
        : 0;
    case 'SwitchCase':
      // `default:` adds no path.
      return counting.switchCases === 'each' && node.test !== null ? 1 : 0;
    case 'LogicalExpression':
      // 1 each, or with `sequence`, the outermost operator of an expression counts its runs, in
      // source order, and the rest add 0.
      if (counting.logicalOperators === 'each') return 1;
      return parent.type === 'LogicalExpression' ? 0 : operatorRuns(node);
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

/**
 * The runs of the same operator in a logical expression, in source order, looking through
 * parentheses: `a && b && c` is one, `a && b || c` two, and `a || b && c || d` three.
 */
function operatorRuns(node: AstNode) {
  const operators: string[] = [];
  function walk(n: AstNode) {
    if (n.type === 'ParenthesizedExpression') walk(n.expression as AstNode);
    else if (n.type === 'LogicalExpression') {
      walk(n.left as AstNode);
      operators.push(n.operator as string);
      walk(n.right as AstNode);
    }
  }
  walk(node);
  // operators[-1] is undefined, so the first operator always starts a run.
  // Stryker disable next-line ArithmeticOperator: comparing with the next operator instead counts each run by its end rather than its start, and every run has one of each.
  return operators.filter((op, i) => operators[i - 1] !== op).length;
}

/**
 * 1, plus one for each branch in the function's body and parameters. A nested function's branches
 * count too when `counting.nestedFunctions` is `enclosing`, and not when it's `own`. `also` counts
 * what this file can't see on its own, such as reads of the module's lookup tables.
 */
export function complexity(fn: AstNode, counting: Counting, also: (node: AstNode) => number) {
  let count = 1;
  function enters(child: AstNode) {
    return counting.nestedFunctions === 'enclosing' || !isFunctionType(child.type);
  }
  function visit(node: AstNode, parent: AstNode) {
    count += adds(node, parent, counting) + also(node);
    // Parentheses don't break a run of operators, so a child of them sees what's outside them.
    const own = node.type === 'ParenthesizedExpression' ? parent : node;
    for (const child of children(node)) if (enters(child)) visit(child, own);
  }
  for (const child of children(fn)) if (enters(child)) visit(child, fn);
  return count;
}
