// Parses a source file with oxc-parser into its functions, each with its place, a label for
// findings and its complexity, and its comments.
import { parseSync } from 'oxc-parser';
import {
  type AstNode,
  children,
  complexity,
  COUNT_ALL,
  type Counting,
  isFunctionType,
  isNode,
} from './complexity.ts';
import { recursive } from './recursion.ts';
import { type Exports, type Imported, lookupAdds, type Readable, tablesIn } from './tables.ts';

/** A 1-based line and a 0-based column in UTF-16 units, as istanbul coverage reports use. */
export type Position = { readonly line: number; readonly column: number };
export type Range = { readonly start: Position; readonly end: Position };
export type Fn = Range & {
  /** Its own label, such as "changeDisplayCurrency" or "seed.items.forEach callback". */
  readonly label: string;
  /** Its label inside the functions around it: "RoomView > changeDisplayCurrency". */
  readonly name: string;
  // oxlint-disable-next-line readonly/types -- countRecursion adds to it in place: a nested function's `parents` holds this Fn itself, so a copy would leave them stale.
  complexity: number;
  /** UTF-16 offsets of the function in its file. */
  readonly offset: { readonly start: number; readonly end: number };
  /** The functions it sits inside, outermost first. */
  readonly parents: readonly Fn[];
  /** Whether it's passed straight to a call, as `items.forEach(() => …)` passes its callback. */
  readonly passedToCall: boolean;
};
export type Comment = {
  readonly type: 'Line' | 'Block';
  readonly value: string;
  readonly start: number;
  readonly end: number;
};
export type Parsed = {
  /** The functions scored: all of them, or with `enclosing` counting only the outermost. */
  readonly functions: readonly Fn[];
  /** With `enclosing` counting, the functions inside a scored one, which count towards it. */
  readonly nested: readonly Fn[];
  readonly comments: readonly Comment[];
  /**
   * The UTF-16 offsets of every simple statement, outermost first: an expression, a variable
   * declaration, a `return` or an export. Not a block, a loop, an `if`, a class or a function.
   */
  readonly statements: readonly { readonly start: number; readonly end: number }[];
  readonly position: (offset: number) => Position;
};

/** The statements a formatter might wrap a call in, which a @crap-allow comment can sit above. */
const SIMPLE_STATEMENTS = new Set([
  'ExpressionStatement',
  'VariableDeclaration',
  'ReturnStatement',
  'ExportNamedDeclaration',
  'ExportDefaultDeclaration',
]);

export class ParseError extends Error {}

/** Converts UTF-16 offsets in `source` to lines and columns. */
export function positions(source: string) {
  const lineStarts = [0];
  for (let i = source.indexOf('\n'); i !== -1; i = source.indexOf('\n', i + 1)) {
    lineStarts.push(i + 1);
  }
  return (offset: number): Position => {
    let low = 0;
    // Stryker disable next-line ArithmeticOperator: a `high` past the last line start only probes entries that don't exist, and `undefined <= offset` is false, so the search narrows back to the same line.
    let high = lineStarts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (lineStarts[middle] <= offset) low = middle;
      else high = middle - 1;
    }
    return { line: low + 1, column: offset - lineStarts[low] };
  };
}

/** The source text of `node`, if it's short enough to read as a name. */
function text(source: string, node: unknown) {
  if (!isNode(node)) return undefined;
  const value = source.slice(node.start, node.end);
  return value.length <= 40 && !value.includes('\n') ? value : undefined;
}

/** A label for a function, from its own name or what it's assigned or passed to. */
export function label(source: string, fn: AstNode, parent: AstNode | undefined) {
  const own = fn.id;
  // A function's `id`, when it has one, is an Identifier, whose name is a string.
  if (isNode(own)) return own.name as string;
  return (parent && nameFromParent(source, fn, parent)) ?? '(anonymous)';
}

/** The name a function's parent gives it, as `const f = …` names `f`, or nothing if it can't. */
function nameFromParent(source: string, fn: AstNode, parent: AstNode) {
  switch (parent.type) {
    case 'VariableDeclarator':
      return text(source, parent.id);
    case 'Property':
    case 'MethodDefinition':
    case 'PropertyDefinition':
      return text(source, parent.key);
    case 'AssignmentExpression':
      return text(source, parent.left);
    case 'CallExpression':
    case 'NewExpression':
      // A function the call calls, as an IIFE is, isn't passed to it, so it has no name.
      return passedToCall(fn, parent) ? callback(text(source, parent.callee)) : undefined;
    case 'ExportDefaultDeclaration':
      return 'default export';
    default:
      return undefined;
  }
}

/** A callback's label, from the call it's passed to. */
function callback(callee: string | undefined) {
  return callee ? `${callee} callback` : undefined;
}

/**
 * The JSX attribute a handler is the value of, as in `onClick={() => …}`, from the ancestors of a
 * function in a JSX expression. A JSX child's expression sits in an element or fragment instead,
 * which has no name.
 */
function jsxAttribute(source: string, ancestors: readonly AstNode[]) {
  return text(source, ancestors[ancestors.length - 2].name);
}

/** What one file's walk needs throughout: its text, how to count, and where each offset is. */
type Source = {
  readonly text: string;
  readonly counting: Counting;
  readonly position: (offset: number) => Position;
  /** The lookup tables the module can read, own and imported, and the uses a local hides. */
  readonly tables: Readable;
};
/** What a walk finds: each function with the node it came from, and the simple statements. */
type Found = {
  // oxlint-disable-next-line readonly/types -- walk() adds to one list in place, so deeply nested code needs no copy at each level.
  readonly functions: { readonly fn: Fn; readonly node: AstNode }[];
  // oxlint-disable-next-line readonly/types -- walk() adds to one list in place, as for `functions`.
  readonly statements: { readonly start: number; readonly end: number }[];
};

/**
 * Adds the functions and simple statements in `node` and below it to `into`, in source order, and
 * returns it. Adding to one list, rather than joining each child's, keeps each level of the tree
 * to one small stack frame, as deeply nested code needs.
 */
function walk(
  node: AstNode,
  ancestors: readonly AstNode[],
  enclosing: readonly Fn[],
  source: Source,
  into: Found = { functions: [], statements: [] },
): Found {
  const inside = record(node, ancestors, enclosing, source, into);
  for (const child of children(node)) walk(child, [...ancestors, node], inside, source, into);
  return into;
}

/**
 * Adds `node` to `into` if it's a simple statement or a function, and returns the functions
 * around its children: `enclosing`, and `node` too if it's a function.
 */
function record(
  node: AstNode,
  ancestors: readonly AstNode[],
  enclosing: readonly Fn[],
  source: Source,
  into: Found,
): readonly Fn[] {
  if (SIMPLE_STATEMENTS.has(node.type)) into.statements.push({ start: node.start, end: node.end });
  if (!isFunctionType(node.type) || !node.body) return enclosing;
  const fn = describe(node, ancestors, enclosing, source);
  into.functions.push({ fn, node });
  return [...enclosing, fn];
}

/** A function node as a scored `Fn`: its name, complexity and place. */
function describe(
  node: AstNode,
  ancestors: readonly AstNode[],
  enclosing: readonly Fn[],
  source: Source,
): Fn {
  // A function always has a parent: only the Program has none.
  const parent = ancestors[ancestors.length - 1];
  const own =
    parent.type === 'JSXExpressionContainer'
      ? (jsxAttribute(source.text, ancestors) ?? '(anonymous)')
      : label(source.text, node, parent);
  return {
    label: own,
    name: [...enclosing.map((outer) => outer.label), own].join(' > '),
    complexity: complexity(node, source.counting, (child) =>
      source.counting.lookupTables ? lookupAdds(child, source.tables, source.counting) : 0,
    ),
    offset: { start: node.start, end: node.end },
    start: source.position(node.start),
    end: source.position(node.end),
    parents: enclosing,
    passedToCall: passedToCall(node, parent),
  };
}

/**
 * Adds 1 to each scored function in a recursion cycle. A call counts towards the scored function
 * it's written in; it reaches a function only if that function is scored itself.
 */
function countRecursion(
  program: AstNode,
  found: Found['functions'],
  scored: readonly Fn[],
  counting: Counting,
) {
  const enclosing = counting.nestedFunctions === 'enclosing';
  const byNode = new Map(found.map(({ fn, node }) => [node, fn]));
  const scoredSet = new Set(scored);
  const cycles = recursive(
    program,
    (node) => {
      const fn = byNode.get(node);
      return fn && enclosing ? (fn.parents[0] ?? fn) : fn;
    },
    (node) => {
      const fn = byNode.get(node);
      // Stryker disable next-line ConditionalExpression,LogicalOperator: with `own` counting every function is scored; with `enclosing`, `callerOf` gives every call to an outermost function, so an unscored nested one never calls out and can't be in a cycle, whether calls reach it or not.
      return fn && scoredSet.has(fn) ? fn : undefined;
    },
  );
  // In place: a nested function's `parents` holds its outer `Fn` itself, so a copy would break it.
  for (const fn of cycles) fn.complexity += 1;
}

/** Whether `node` is passed straight to a call, as `items.forEach(() => …)` passes its callback. */
function passedToCall(node: AstNode, parent: AstNode) {
  // Only a call or a `new` has `arguments`.
  return Array.isArray(parent.arguments) && parent.arguments.includes(node);
}

/**
 * A file's functions, comments and simple statements. `imported(from)` gives what the module a
 * relative import names exports, `from` as the file writes it, so the tables and functions it
 * imports count as they do in their own module; with none given, only the file's own do.
 */
export function parse(
  file: string,
  source: string,
  counting: Counting = COUNT_ALL,
  imported: Imported = () => undefined,
): Parsed {
  const result = parseSync(file, source);
  if (result.errors.length > 0) {
    throw new ParseError(`Couldn't parse ${file}: ${result.errors[0].message}`);
  }
  const program = result.program as unknown as AstNode;
  const position = positions(source);
  const tables = tablesIn(program, imported).readable;
  // Stryker disable next-line ArrayDeclaration: the root's ancestors are only ever read from the end, as the parent at `length - 1` and, beside a JSX expression, which is never a top-level node, the attribute at `length - 2`, so an entry at the start is never read.
  const found = walk(program, [], [], { text: source, counting, position, tables });
  const enclosing = counting.nestedFunctions === 'enclosing';
  const all = found.functions.map(({ fn }) => fn);
  const scored = enclosing ? all.filter((fn) => fn.parents.length === 0) : all;
  if (counting.recursion) countRecursion(program, found.functions, scored, counting);
  const comments = (result.comments as readonly Comment[]).map(({ type, value, start, end }) => ({
    type,
    value,
    start,
    end,
  }));
  return {
    functions: scored,
    nested: enclosing ? all.filter((fn) => fn.parents.length > 0) : [],
    comments,
    statements: found.statements,
    position,
  };
}

/**
 * The lookup tables and functions a module exports, for a file that imports them. A module that
 * doesn't parse exports none here; it's reported when it's scored itself.
 */
export function moduleExports(file: string, source: string): Exports {
  const result = parseSync(file, source);
  if (result.errors.length > 0) return { tables: new Map(), functions: new Set() };
  return tablesIn(result.program as unknown as AstNode).exported;
}
