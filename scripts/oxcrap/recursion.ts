// Finds the scored functions in a recursion cycle: those that call themselves, or call a function
// that leads back to them. A call is resolved as JavaScript resolves it, within the file:
// - a bare `f()` to the function bound to `f` in the nearest enclosing scope, so a parameter or a
//   local of the same name hides it;
// - `this.f()` to a method or function-valued field of the class around the call, unless a
//   non-arrow function in between rebinds `this`.
// Calls through other objects, variables or files aren't followed. Why is in oxcrap.meta.md.
import { type AstNode, children, isFunctionType, isNode } from './complexity.ts';

/** A scope's names, each bound to the function it names, or to null for anything else. */
type Scope = Map<string, AstNode | null>;
/** A class's methods and function-valued fields, by name. */
type Members = Map<string, AstNode>;

/** Whether a node besides a function opens a scope of its own. */
function opensScope(node: AstNode) {
  switch (node.type) {
    case 'Program':
    case 'BlockStatement':
    case 'StaticBlock':
    case 'SwitchStatement':
    case 'CatchClause':
    case 'ForStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
      return true;
    // Stryker disable next-line ConditionalExpression: an empty default returns undefined, which every caller treats as false.
    default:
      // Stryker disable next-line BooleanLiteral: a node not listed would open a scope that declares nothing, which changes no lookup.
      return false;
  }
}

/** The names a binding pattern, such as a parameter or a destructuring, declares. */
// Stryker disable next-line ArrayDeclaration: the seeded name has spaces in it, so no identifier is ever looked up under it.
function boundNames(pattern: unknown, into: string[] = []): string[] {
  if (!isNode(pattern)) return into;
  // Stryker disable next-line ConditionalExpression: no other binding pattern has a `name`, so this would only add undefined, which no lookup asks for.
  if (pattern.type === 'Identifier') into.push(pattern.name as string);
  for (const part of patternParts(pattern)) boundNames(part, into);
  return into;
}

/** The patterns directly inside a binding pattern: an array's elements, an object's values. */
function patternParts(pattern: AstNode): unknown[] {
  switch (pattern.type) {
    case 'AssignmentPattern':
      return [pattern.left];
    case 'RestElement':
      return [pattern.argument];
    case 'TSParameterProperty':
      return [pattern.parameter];
    case 'ArrayPattern':
      return pattern.elements as unknown[];
    case 'ObjectPattern':
      return (pattern.properties as AstNode[]).map((property) =>
        property.type === 'RestElement' ? property : property.value,
      );
    default:
      // Stryker disable next-line ArrayDeclaration: a string isn't a node, so boundNames ignores it.
      return [];
  }
}

/** A declarator's function, for `const f = () => …` and `const f = function () {}`. */
function functionValue(node: unknown): AstNode | null {
  if (!isNode(node)) return null;
  if (node.type === 'ParenthesizedExpression') return functionValue(node.expression);
  return isFunctionType(node.type) ? node : null;
}

/** Declares `id`, if there is one, as naming `fn`. */
function declareId(scope: Scope, id: unknown, fn: AstNode | null) {
  if (isNode(id)) scope.set(id.name as string, fn);
}

/** Declares every name `pattern` binds, as naming no function. */
function declarePattern(scope: Scope, pattern: unknown) {
  for (const name of boundNames(pattern)) scope.set(name, null);
}

/** Declares into `scope` what `statements` declare directly: functions, classes, let and const. */
function declareBlock(scope: Scope, statements: readonly AstNode[]) {
  for (const statement of statements) declareStatement(scope, exported(statement));
}

/** What an export statement declares, or the statement itself if it isn't one. */
function exported(statement: AstNode): AstNode {
  // Stryker disable next-line Regex: no other node type contains ExportNamedDeclaration or ExportDefaultDeclaration, so the anchors change no match.
  const isExport = /^Export(Named|Default)Declaration$/.test(statement.type);
  return isExport && isNode(statement.declaration) ? statement.declaration : statement;
}

/** Declares into `scope` what one statement declares, other than `var`. */
function declareStatement(scope: Scope, statement: AstNode) {
  switch (statement.type) {
    case 'FunctionDeclaration':
      declareId(scope, statement.id, statement);
      break;
    case 'ClassDeclaration':
      declareId(scope, statement.id, null);
      break;
    case 'VariableDeclaration':
      declareLexical(scope, statement);
  }
}

/** Declares into `scope` what `node` declares if it's a `let` or `const` declaration. */
function declareLexical(scope: Scope, node: unknown) {
  if (isNode(node) && node.type === 'VariableDeclaration' && node.kind !== 'var') {
    declareVariables(scope, node);
  }
}

function declareVariables(scope: Scope, declaration: AstNode) {
  for (const declarator of declaration.declarations as AstNode[]) {
    const value =
      isNode(declarator.id) && declarator.id.type === 'Identifier'
        ? functionValue(declarator.init)
        : null;
    for (const name of boundNames(declarator.id)) scope.set(name, value);
  }
}

/** Declares into `scope` every `var` in `node`, not looking inside nested functions. */
function declareVars(scope: Scope, node: AstNode) {
  for (const child of children(node)) {
    if (isFunctionType(child.type)) continue;
    // Only a VariableDeclaration has a `kind` of 'var'.
    if (child.kind === 'var') declareVariables(scope, child);
    declareVars(scope, child);
  }
}

/** The scope a function opens: its own name if it's a named expression, its parameters, its body's. */
function functionScope(fn: AstNode): Scope {
  const scope: Scope = new Map();
  // A named function expression can call itself by its own name.
  if (fn.type === 'FunctionExpression') declareId(scope, fn.id, fn);
  for (const param of fn.params as unknown[]) declarePattern(scope, param);
  // Every function of the three function types has a body; a signature without one has a type of its own.
  const body = fn.body as AstNode;
  declareVars(scope, body);
  if (body.type === 'BlockStatement') declareBlock(scope, body.body as AstNode[]);
  return scope;
}

/** The scope a node opens, for a node `opensScope` accepts, with what it declares directly. */
function blockScope(node: AstNode): Scope {
  const scope: Scope = new Map();
  switch (node.type) {
    case 'Program':
      declareVars(scope, node);
      declareBlock(scope, node.body as AstNode[]);
      break;
    case 'BlockStatement':
    case 'StaticBlock':
      declareBlock(scope, node.body as AstNode[]);
      break;
    case 'SwitchStatement':
      for (const switchCase of node.cases as AstNode[]) {
        declareBlock(scope, switchCase.consequent as AstNode[]);
      }
      break;
    case 'CatchClause':
      declarePattern(scope, node.param);
      break;
    default:
      // A loop: what its head declares, as in `for (const x of xs)`.
      declareLexical(scope, node.init ?? node.left);
  }
  return scope;
}

/** A class body's methods and function-valued fields, by name. */
function classMembers(body: AstNode): Members {
  const members: Members = new Map();
  for (const member of body.body as AstNode[]) {
    if (member.computed || !isNode(member.key) || member.key.type !== 'Identifier') continue;
    const value = functionValue(member.value);
    if (value) members.set(member.key.name as string, value);
  }
  return members;
}

/** The name `f` a `this.f()` call is to, or undefined for any other callee. */
function thisMethod(callee: AstNode): string | undefined {
  // Only a MemberExpression has an `object`.
  const isThis =
    !callee.computed && isNode(callee.object) && callee.object.type === 'ThisExpression';
  return isThis && isNode(callee.property) ? (callee.property.name as string) : undefined;
}

/**
 * The uses of `names` that a binding inside a function or block hides from the module's top level:
 * a parameter, a local, or a catch or loop variable of the same name. tables.ts reads a table only
 * through a use this doesn't list.
 */
export function shadowedUses(program: AstNode, names: ReadonlySet<string>): ReadonlySet<AstNode> {
  return hidden(program, [], names, new Set());
}

/** Adds the uses of `names` in `node` and below that an inner scope hides, to `into`. */
function hidden(
  node: AstNode,
  scopes: readonly Scope[],
  names: ReadonlySet<string>,
  into: Set<AstNode>,
) {
  if (node.type === 'Identifier' && names.has(node.name as string)) {
    const name = node.name as string;
    // Scope 0 is the program's own: a binding found further in hides the top-level one.
    if (scopes.findLastIndex((scope) => scope.has(name)) > 0) into.add(node);
  }
  const inner = scopesInside(node, scopes);
  for (const child of children(node)) hidden(child, inner, names, into);
  return into;
}

/** The scopes around `node`'s children: `scopes`, and the one `node` opens, if any. */
function scopesInside(node: AstNode, scopes: readonly Scope[]): readonly Scope[] {
  if (isFunctionType(node.type)) return [...scopes, functionScope(node)];
  return opensScope(node) ? [...scopes, blockScope(node)] : scopes;
}

/**
 * The scored functions in a recursion cycle.
 * - `callerOf` maps the function a call is written in to the scored function it counts towards:
 *   itself, or with nested functions counting towards the outermost, that one.
 * - `scoredAt` maps a called function to itself if it's scored, and to nothing if not. Calling a
 *   nested helper of your own isn't recursion; a nested callback calling back into you is.
 */
export function recursive<Fn>(
  program: AstNode,
  callerOf: (node: AstNode) => Fn | undefined,
  scoredAt: (node: AstNode) => Fn | undefined,
) {
  const calls = callsIn(program, { scopes: [], fn: undefined, self: null }, null);
  return inCycles(graphOf(calls, callerOf, scoredAt));
}

/**
 * Where a node sits: the scopes around it, innermost last; the function it's in; and the class
 * members that function's `this` reaches, or null.
 */
type Context = { scopes: readonly Scope[]; fn: AstNode | undefined; self: Members | null };
/** A call from the function it's written in to the function it resolves to, if any. */
type Call = { from: AstNode | undefined; to: AstNode | null | undefined };

/**
 * Adds the calls in `node` and below it to `into`, in the scope and `this` each kind of node gives
 * its children, and returns it. `members` is what `this` reaches in a class member's function.
 * Adding to one list, rather than joining each child's, keeps each level of the tree to one stack
 * frame, as deeply nested code needs.
 */
function callsIn(
  node: AstNode,
  context: Context,
  members: Members | null,
  // Stryker disable next-line ArrayDeclaration: a seeded entry that isn't a call has no `from`, so graphOf skips it.
  into: Call[] = [],
): Call[] {
  if (node.type === 'ClassBody') return callsInClass(node, context, into);
  if (isFunctionType(node.type)) return callsInFunction(node, context, members, into);
  if (node.type === 'CallExpression') into.push(...callsOf(node, context));
  const inner = opensScope(node)
    ? { ...context, scopes: [...context.scopes, blockScope(node)] }
    : context;
  for (const child of children(node)) callsIn(child, inner, members, into);
  return into;
}

/** A bare `f()` or a `this.f()`, resolved to the function it calls. */
function callsOf(call: AstNode, context: Context): Call[] {
  const callee = call.callee as AstNode;
  // Stryker disable next-line ConditionalExpression: any other callee has no `name`, and no scope declares an undefined name, so its lookup finds no function.
  const named = callee.type === 'Identifier' ? [lookup(context.scopes, callee.name as string)] : [];
  const method = thisMethod(callee);
  // Stryker disable next-line ConditionalExpression: a class has no member named undefined, so the lookup finds no function.
  const viaThis = method === undefined ? [] : [context.self?.get(method)];
  return [...named, ...viaThis].map((to) => ({ from: context.fn, to }));
}

/** Adds the calls in a class's members to `into`, each with the class's methods and fields as its `this`. */
function callsInClass(body: AstNode, context: Context, into: Call[]): Call[] {
  const own = classMembers(body);
  for (const member of body.body as AstNode[]) {
    // A method's or field's function gets the class as its `this`. callsIn hands it on through
    // parentheses around the function.
    for (const child of children(member)) callsIn(child, context, own, into);
  }
  return into;
}

/** Adds the calls in a function, in its own scope, to `into`. */
function callsInFunction(
  fn: AstNode,
  context: Context,
  members: Members | null,
  into: Call[],
): Call[] {
  // An arrow keeps the `this` around it; any other function has its own.
  // A class field's arrow has the instance as its `this`, which `members` then gives.
  const self = fn.type === 'ArrowFunctionExpression' ? (members ?? context.self) : members;
  const scopes = [...context.scopes, functionScope(fn)];
  for (const child of children(fn)) callsIn(child, { scopes, fn, self }, null, into);
  return into;
}

/** What `name` is bound to in the nearest scope that declares it, or undefined if none does. */
function lookup(scopes: readonly Scope[], name: string) {
  return scopes.findLast((scope) => scope.has(name))?.get(name);
}

/**
 * For each scored function, the scored functions it calls: a call counts towards the scored
 * function `callerOf` gives, and reaches one only if `scoredAt` gives one.
 */
function graphOf<Fn>(
  calls: Call[],
  callerOf: (node: AstNode) => Fn | undefined,
  scoredAt: (node: AstNode) => Fn | undefined,
) {
  const edges = new Map<Fn, Set<Fn>>();
  for (const { from, to } of calls) {
    const source = from ? callerOf(from) : undefined;
    const target = to ? scoredAt(to) : undefined;
    // Stryker disable next-line ConditionalExpression: an edge from undefined, or one to it, can't close a cycle while the other check stays, since undefined is then only ever a source or only ever a target.
    if (source === undefined || target === undefined) continue;
    edges.set(source, (edges.get(source) ?? new Set<Fn>()).add(target));
  }
  return edges;
}

/** The nodes in a cycle of `edges`: those that lead back to themselves. */
function inCycles<Fn>(edges: Map<Fn, Set<Fn>>) {
  return new Set([...edges.keys()].filter((fn) => reachable(edges, fn).has(fn)));
}

/** The nodes `start` leads to by one edge or more. */
function reachable<Fn>(edges: Map<Fn, Set<Fn>>, start: Fn) {
  const seen = new Set<Fn>();
  // `start` is one of the keys of `edges`.
  const next = [...(edges.get(start) as Set<Fn>)];
  while (next.length > 0) {
    const fn = next.pop() as Fn;
    if (seen.has(fn)) continue;
    seen.add(fn);
    // Stryker disable next-line ArrayDeclaration: the seeded string is no function, so it adds no way back to one.
    next.push(...(edges.get(fn) ?? []));
  }
  return seen;
}
