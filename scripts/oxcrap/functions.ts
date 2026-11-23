// Parses a source file with oxc-parser into its functions, each with its place, a label for
// findings and its complexity, and its comments.
import { parseSync } from 'oxc-parser';
import {
  type AstNode,
  calls,
  children,
  complexity,
  COUNT_ALL,
  type Counting,
  FUNCTION_TYPES,
  isNode,
} from './complexity.ts';

/** A 1-based line and a 0-based column in UTF-16 units, as istanbul coverage reports use. */
export type Position = { line: number; column: number };
export type Range = { start: Position; end: Position };
export type Fn = Range & {
  /** Its own label, such as "changeDisplayCurrency" or "seed.items.forEach callback". */
  label: string;
  /** Its label inside the functions around it: "RoomView > changeDisplayCurrency". */
  name: string;
  complexity: number;
  /** UTF-16 offsets of the function in its file. */
  offset: { start: number; end: number };
  /** The functions it sits inside, outermost first. */
  parents: Fn[];
  /** Whether it's passed straight to a call, as `items.forEach(() => …)` passes its callback. */
  passedToCall: boolean;
};
export type Comment = { type: 'Line' | 'Block'; value: string; start: number; end: number };
export type Parsed = {
  /** The functions scored: all of them, or with `enclosing` counting only the outermost. */
  functions: Fn[];
  /** With `enclosing` counting, the functions inside a scored one, which count towards it. */
  nested: Fn[];
  comments: Comment[];
  /**
   * The UTF-16 offsets of every simple statement, outermost first: an expression, a variable
   * declaration, a `return` or an export. Not a block, a loop, an `if`, a class or a function.
   */
  statements: { start: number; end: number }[];
  position: (offset: number) => Position;
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
  if (isNode(own) && typeof own.name === 'string') return own.name;
  if (!parent) return '(anonymous)';
  switch (parent.type) {
    case 'VariableDeclarator':
      return text(source, parent.id) ?? '(anonymous)';
    case 'Property':
    case 'MethodDefinition':
    case 'PropertyDefinition':
      return text(source, parent.key) ?? '(anonymous)';
    case 'AssignmentExpression':
      return text(source, parent.left) ?? '(anonymous)';
    case 'CallExpression':
    case 'NewExpression': {
      const callee = text(source, parent.callee);
      return callee ? `${callee} callback` : '(anonymous)';
    }
    case 'ExportDefaultDeclaration':
      return 'default export';
    default:
      return '(anonymous)';
  }
}

/** The JSX attribute a handler is the value of, as in `onClick={() => …}`. */
function jsxAttribute(source: string, ancestors: AstNode[]) {
  const [container, attribute] = ancestors.slice(-2).reverse();
  if (container?.type !== 'JSXExpressionContainer' || attribute?.type !== 'JSXAttribute') {
    return undefined;
  }
  return text(source, attribute.name);
}

export function parse(file: string, source: string, counting: Counting = COUNT_ALL): Parsed {
  const result = parseSync(file, source);
  if (result.errors.length > 0) {
    throw new ParseError(`Couldn't parse ${file}: ${result.errors[0].message}`);
  }
  const position = positions(source);
  const functions: Fn[] = [];
  const nodes = new Map<Fn, AstNode>();
  const statements: Parsed['statements'] = [];

  const visit = (node: AstNode, ancestors: AstNode[], enclosing: Fn[]) => {
    let inside = enclosing;
    if (SIMPLE_STATEMENTS.has(node.type)) statements.push({ start: node.start, end: node.end });
    if (FUNCTION_TYPES.has(node.type) && node.body) {
      const parent = ancestors.at(-1);
      const own =
        parent?.type === 'JSXExpressionContainer'
          ? (jsxAttribute(source, ancestors) ?? '(anonymous)')
          : label(source, node, parent);
      const fn: Fn = {
        label: own,
        name: [...enclosing.map((outer) => outer.label), own].join(' > '),
        complexity: complexity(node, counting),
        offset: { start: node.start, end: node.end },
        start: position(node.start),
        end: position(node.end),
        parents: enclosing,
        passedToCall:
          (parent?.type === 'CallExpression' || parent?.type === 'NewExpression') &&
          Array.isArray(parent.arguments) &&
          parent.arguments.includes(node),
      };
      functions.push(fn);
      nodes.set(fn, node);
      inside = [...enclosing, fn];
    }
    for (const child of children(node)) visit(child, [...ancestors, node], inside);
  };
  visit(result.program as unknown as AstNode, [], []);

  const comments = (result.comments as Comment[]).map(({ type, value, start, end }) => ({
    type,
    value,
    start,
    end,
  }));
  const enclosing = counting.nestedFunctions === 'enclosing';
  const scored = enclosing ? functions.filter((fn) => fn.parents.length === 0) : functions;
  if (counting.recursion) countRecursion(scored, nodes, counting);
  return {
    functions: scored,
    nested: enclosing ? functions.filter((fn) => fn.parents.length > 0) : [],
    comments,
    statements,
    position,
  };
}

/**
 * Adds 1 to each scored function in a recursion cycle: one that calls itself, or calls one that
 * leads back to it. Calls are matched by name within the file, as `f()` or `this.f()`.
 */
function countRecursion(scored: Fn[], nodes: Map<Fn, AstNode>, counting: Counting) {
  const byName = new Map<string, Fn[]>();
  for (const fn of scored) byName.set(fn.label, [...(byName.get(fn.label) ?? []), fn]);
  const callees = new Map<Fn, Fn[]>(
    scored.map((fn) => [
      fn,
      [...calls(nodes.get(fn) as AstNode, counting)].flatMap((name) => byName.get(name) ?? []),
    ]),
  );
  for (const fn of scored) {
    const seen = new Set<Fn>();
    const queue = [...(callees.get(fn) ?? [])];
    while (queue.length > 0) {
      const next = queue.shift() as Fn;
      if (next === fn) {
        fn.complexity += 1;
        break;
      }
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(...(callees.get(next) ?? []));
    }
  }
}
