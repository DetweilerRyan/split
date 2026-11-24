// Finds the scored functions in a recursion cycle: those that call themselves, or call a function
// that leads back to them. A call is resolved as JavaScript resolves it, within the file:
// - a bare `f()` or `new f()` to the function bound to `f` in the nearest enclosing scope, so a
//   parameter or a local of the same name hides it. A default value sees the parameters and the
//   scopes around the function, not the body's locals;
// - `this.f()` or `this.#f()` to a method or function-valued field of that name in the class
//   around the call, unless a non-arrow function in between rebinds `this`. In a static method,
//   field or block, `this` is the class and reaches its static members; anywhere else in the class
//   it's the instance and reaches the rest. A field hides a method of the same name on its side,
//   so if it holds no function, the call reaches none.
// Calls through other objects, variables or files aren't followed. Why is in oxcrap.meta.md.
import { type AstNode, children, isFunctionType, isNode } from './complexity.ts';

/** A scope's names, each bound to the function it names, or to null for anything else. */
type Scope = ReadonlyMap<string, AstNode | null>;
/**
 * What `this.f()` reaches from an instance's or a class's `this`, by name, with `#` before a
 * private one: a method or a function-valued field, or null for a member that holds no function,
 * such as a field or an accessor. Members with a computed or literal key, and static blocks, are
 * under undefined, which no call is to.
 */
type Members = ReadonlyMap<string | undefined, AstNode | null>;
// What the functions below fill in place. A walk adds to one list or set, rather than joining
// each child's, so each level of the tree takes one stack frame, as deeply nested code needs.
// oxlint-disable-next-line readonly/types -- a new scope, which the declare functions fill in place before it's read.
type Filling = Map<string, AstNode | null>;
// oxlint-disable-next-line readonly/types -- the list boundNames' walk adds to in place.
type Names = string[];
// oxlint-disable-next-line readonly/types -- the set hidden's walk adds to in place.
type Hidden = Set<AstNode>;
// oxlint-disable-next-line readonly/types -- the list callsIn's walk adds to in place.
type Calls = Call[];

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
function boundNames(pattern: unknown, into: Names = []): readonly string[] {
  if (!isNode(pattern)) return into;
  // Stryker disable next-line ConditionalExpression: no other binding pattern has a `name`, so this would only add undefined, which no lookup asks for.
  if (pattern.type === 'Identifier') into.push(pattern.name as string);
  for (const part of patternParts(pattern)) boundNames(part, into);
  return into;
}

/** The patterns directly inside a binding pattern: an array's elements, an object's values. */
function patternParts(pattern: AstNode): readonly unknown[] {
  switch (pattern.type) {
    case 'AssignmentPattern':
      return [pattern.left];
    case 'RestElement':
      return [pattern.argument];
    case 'TSParameterProperty':
      return [pattern.parameter];
    case 'ArrayPattern':
      return pattern.elements as readonly unknown[];
    case 'ObjectPattern':
      return (pattern.properties as readonly AstNode[]).map((property) =>
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
function declareId(scope: Filling, id: unknown, fn: AstNode | null) {
  if (isNode(id)) scope.set(id.name as string, fn);
}

/** Declares every name `pattern` binds, as naming no function. */
function declarePattern(scope: Filling, pattern: unknown) {
  for (const name of boundNames(pattern)) scope.set(name, null);
}

/** Declares into `scope` what `statements` declare directly: functions, classes, let and const. */
function declareBlock(scope: Filling, statements: readonly AstNode[]) {
  for (const statement of statements) declareStatement(scope, exported(statement));
}

/**
 * What an export statement declares, or the statement itself if it isn't one. Only the two export
 * declarations have a `declaration`.
 */
function exported(statement: AstNode): AstNode {
  return isNode(statement.declaration) ? statement.declaration : statement;
}

/** Declares into `scope` what one statement declares, other than `var`. */
function declareStatement(scope: Filling, statement: AstNode) {
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
function declareLexical(scope: Filling, node: unknown) {
  if (isNode(node) && node.type === 'VariableDeclaration' && node.kind !== 'var') {
    declareVariables(scope, node);
  }
}

function declareVariables(scope: Filling, declaration: AstNode) {
  for (const declarator of declaration.declarations as readonly AstNode[]) {
    const value =
      isNode(declarator.id) && declarator.id.type === 'Identifier'
        ? functionValue(declarator.init)
        : null;
    for (const name of boundNames(declarator.id)) scope.set(name, value);
  }
}

/** Declares into `scope` every `var` in `node`, not looking inside functions or static blocks. */
function declareVars(scope: Filling, node: AstNode) {
  for (const child of children(node)) {
    if (isFunctionType(child.type) || child.type === 'StaticBlock') continue;
    // Only a VariableDeclaration has a `kind` of 'var'.
    if (child.kind === 'var') declareVariables(scope, child);
    declareVars(scope, child);
  }
}

/**
 * The scopes around a function's parameters, and around its body. The parameters' scope holds the
 * function's own name if it's a named expression, and its parameters, so a default value sees
 * neither the body's `var`s nor its `let`s. The body's adds its `var`s, and its block the rest.
 */
function functionScopes(fn: AstNode, scopes: readonly Scope[]) {
  const own: Filling = new Map();
  // A named function expression can call itself by its own name.
  if (fn.type === 'FunctionExpression') declareId(own, fn.id, fn);
  for (const param of fn.params as readonly unknown[]) declarePattern(own, param);
  const vars: Filling = new Map();
  // Every function of the three function types has a body; a signature without one has a type of its own.
  declareVars(vars, fn.body as AstNode);
  const params = [...scopes, own];
  return { params, body: [...params, vars] };
}

/** The scope a node opens, for a node `opensScope` accepts, with what it declares directly. */
function blockScope(node: AstNode): Scope {
  const scope: Filling = new Map();
  switch (node.type) {
    // A static block keeps its `var`s to itself, as a function does.
    case 'Program':
    case 'StaticBlock':
      declareVars(scope, node);
      declareBlock(scope, node.body as readonly AstNode[]);
      break;
    case 'BlockStatement':
      declareBlock(scope, node.body as readonly AstNode[]);
      break;
    case 'SwitchStatement':
      for (const switchCase of node.cases as readonly AstNode[]) {
        declareBlock(scope, switchCase.consequent as readonly AstNode[]);
      }
      break;
    case 'CatchClause':
      declarePattern(scope, node.param);
      redeclaredByVar(scope, node.body as AstNode);
      break;
    default:
      // A loop: what its head declares, as in `for (const x of xs)`.
      declareLexical(scope, node.init ?? node.left);
  }
  return scope;
}

/**
 * Gives a catch parameter the value of a `var` in its block that declares it again. The `var` is
 * hoisted out of the block, but in the block its name is the parameter, so its value goes there.
 */
function redeclaredByVar(scope: Filling, block: AstNode) {
  const vars: Filling = new Map();
  declareVars(vars, block);
  for (const [name, value] of vars) if (scope.has(name)) scope.set(name, value);
}

/**
 * What `this.f()` reaches in a class body, by name: `instance` from an instance's `this`, in an
 * instance method or field, and `statics` from the class's, in a static method, field or block.
 */
function classMembers(body: AstNode): { readonly instance: Members; readonly statics: Members } {
  const instance = new Map<string | undefined, AstNode | null>();
  const statics = new Map<string | undefined, AstNode | null>();
  const all = body.body as readonly AstNode[];
  // A field is defined on the instance or the class after the methods are, so it hides a method of
  // its name wherever it's written: the fields go again at the end.
  for (const member of [...all, ...all.filter(isField)]) {
    const name = member.computed ? undefined : memberName(member.key);
    const value = functionValue(member.value);
    (member.static ? statics : instance).set(name, value);
  }
  return { instance, statics };
}

/** Whether a class member is a field, rather than a method or a static block. */
function isField(member: AstNode) {
  return member.type === 'PropertyDefinition';
}

/**
 * A member's name, `f` or `#f`, from its key, or undefined if it has no key, such as a static
 * block, or a literal key, which has a `value` and no `name`.
 */
function memberName(key: unknown): string | undefined {
  if (!isNode(key)) return undefined;
  return key.type === 'PrivateIdentifier'
    ? `#${key.name as string}`
    : (key.name as string | undefined);
}

/** The name, `f` or `#f`, a `this.f()` or `this.#f()` call is to, or undefined for any other callee. */
function thisMethod(callee: AstNode): string | undefined {
  // Only a MemberExpression has an `object`.
  const isThis =
    !callee.computed && isNode(callee.object) && callee.object.type === 'ThisExpression';
  return isThis ? memberName(callee.property) : undefined;
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
function hidden(node: AstNode, scopes: readonly Scope[], names: ReadonlySet<string>, into: Hidden) {
  if (node.type === 'Identifier' && names.has(node.name as string)) {
    const name = node.name as string;
    // Scope 0 is the program's own: a binding found further in hides the top-level one.
    if (scopes.findLastIndex((scope) => scope.has(name)) > 0) into.add(node);
  }
  if (isFunctionType(node.type)) return hiddenInFunction(node, scopes, names, into);
  const inner = opensScope(node) ? [...scopes, blockScope(node)] : scopes;
  for (const child of children(node)) hidden(child, inner, names, into);
  return into;
}

/** Adds the hidden uses in a function to `into`: its parameters in their scope, its body in its own. */
function hiddenInFunction(
  fn: AstNode,
  scopes: readonly Scope[],
  names: ReadonlySet<string>,
  into: Hidden,
) {
  const inner = functionScopes(fn, scopes);
  for (const child of children(fn)) {
    hidden(child, child === fn.body ? inner.body : inner.params, names, into);
  }
  return into;
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
type Context = {
  readonly scopes: readonly Scope[];
  readonly fn: AstNode | undefined;
  readonly self: Members | null;
};
/** A call from the function it's written in to the function it resolves to, if any. */
type Call = { readonly from: AstNode | undefined; readonly to: AstNode | null | undefined };

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
  into: Calls = [],
): readonly Call[] {
  if (node.type === 'ClassBody') return callsInClass(node, context, into);
  if (isFunctionType(node.type)) return callsInFunction(node, context, members, into);
  // `new f()` runs `f`, as `f()` does.
  if (node.type === 'CallExpression' || node.type === 'NewExpression') {
    into.push(...callsOf(node, context));
  }
  const inner = opensScope(node)
    ? { ...context, scopes: [...context.scopes, blockScope(node)] }
    : context;
  for (const child of children(node)) callsIn(child, inner, members, into);
  return into;
}

/** A bare `f()` or a `this.f()`, with or without `new`, resolved to the function it calls. */
function callsOf(call: AstNode, context: Context): readonly Call[] {
  const callee = call.callee as AstNode;
  // Stryker disable next-line ConditionalExpression: any other callee has no `name`, and no scope declares an undefined name, so its lookup finds no function.
  const named = callee.type === 'Identifier' ? [lookup(context.scopes, callee.name as string)] : [];
  const method = thisMethod(callee);
  // Stryker disable next-line ConditionalExpression: a class has no member named undefined, so the lookup finds no function.
  const viaThis = method === undefined ? [] : [context.self?.get(method)];
  return [...named, ...viaThis].map((to) => ({ from: context.fn, to }));
}

/**
 * Adds the calls in a class's members to `into`. A static member's or static block's `this` is the
 * class, and any other member's is the instance.
 */
function callsInClass(body: AstNode, context: Context, into: Calls): readonly Call[] {
  const { instance, statics } = classMembers(body);
  for (const member of body.body as readonly AstNode[]) {
    const self = member.static || member.type === 'StaticBlock' ? statics : instance;
    callsInMember(member, context, self, into);
  }
  return into;
}

/**
 * Adds the calls in a class member to `into`, with `self` as the `this` of its value or static
 * block. callsIn hands `self` on through parentheses around a method's or field's function, and
 * opens a static block's scope.
 */
function callsInMember(member: AstNode, context: Context, self: Members, into: Calls) {
  if (member.type === 'StaticBlock') return callsIn(member, { ...context, self }, self, into);
  for (const child of children(member)) {
    // Only the value runs with the class's `this`. A computed key and decorators run where the
    // class is written, with the `this` around it.
    if (child === member.value) callsIn(child, { ...context, self }, self, into);
    else callsIn(child, context, null, into);
  }
  return into;
}

/** Adds the calls in a function, in its own scope, to `into`. */
function callsInFunction(
  fn: AstNode,
  context: Context,
  members: Members | null,
  into: Calls,
): readonly Call[] {
  // An arrow keeps the `this` around it; any other function has its own.
  // A class field's arrow has the instance as its `this`, which `members` then gives.
  const self = fn.type === 'ArrowFunctionExpression' ? (members ?? context.self) : members;
  const inner = functionScopes(fn, context.scopes);
  for (const child of children(fn)) {
    const scopes = child === fn.body ? inner.body : inner.params;
    callsIn(child, { scopes, fn, self }, null, into);
  }
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
  calls: readonly Call[],
  callerOf: (node: AstNode) => Fn | undefined,
  scoredAt: (node: AstNode) => Fn | undefined,
) {
  const edges: Map<Fn, Set<Fn>> = new Map();
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
function inCycles<Fn>(edges: ReadonlyMap<Fn, ReadonlySet<Fn>>) {
  return new Set([...edges.keys()].filter((fn) => reachable(edges, fn).has(fn)));
}

/** The nodes `start` leads to by one edge or more. */
function reachable<Fn>(edges: ReadonlyMap<Fn, ReadonlySet<Fn>>, start: Fn) {
  const seen = new Set<Fn>();
  // `start` is one of the keys of `edges`.
  const next = [...(edges.get(start) as ReadonlySet<Fn>)];
  while (next.length > 0) {
    const fn = next.pop() as Fn;
    if (seen.has(fn)) continue;
    seen.add(fn);
    // Stryker disable next-line ArrayDeclaration: the seeded string is no function, so it adds no way back to one.
    next.push(...(edges.get(fn) ?? []));
  }
  return seen;
}
