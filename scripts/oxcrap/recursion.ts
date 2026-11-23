// Finds the scored functions in a recursion cycle: those that call themselves, or call a function
// that leads back to them. A call is resolved as JavaScript resolves it, within the file:
// - a bare `f()` to the function bound to `f` in the nearest enclosing scope, so a parameter or a
//   local of the same name hides it;
// - `this.f()` to a method or function-valued field of the class around the call, unless a
//   non-arrow function in between rebinds `this`.
// Calls through other objects, variables or files aren't followed. Why is in oxcrap.meta.md.
import { type AstNode, children, FUNCTION_TYPES, isNode } from './complexity.ts';

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
    default:
      return false;
  }
}
/** The names a binding pattern, such as a parameter or a destructuring, declares. */
function boundNames(pattern: unknown, into: string[] = []): string[] {
  if (!isNode(pattern)) return into;
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
      return (pattern.elements as unknown[]) ?? [];
    case 'ObjectPattern':
      return ((pattern.properties as AstNode[]) ?? []).map((property) =>
        property.type === 'RestElement' ? property : property.value,
      );
    default:
      return [];
  }
}

/** A declarator's function, for `const f = () => …` and `const f = function () {}`. */
function functionValue(node: unknown): AstNode | null {
  if (!isNode(node)) return null;
  if (node.type === 'ParenthesizedExpression') return functionValue(node.expression);
  return FUNCTION_TYPES.has(node.type) ? node : null;
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
function declareBlock(scope: Scope, statements: unknown[]) {
  for (const statement of statements) {
    if (isNode(statement)) declareStatement(scope, exported(statement));
  }
}

/** What an export statement declares, or the statement itself if it isn't one. */
function exported(statement: AstNode): AstNode {
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
      break;
    case 'ImportDeclaration':
      for (const specifier of (statement.specifiers as AstNode[]) ?? []) {
        declareId(scope, specifier.local, null);
      }
  }
}

/** Declares into `scope` what `node` declares if it's a `let` or `const` declaration. */
function declareLexical(scope: Scope, node: unknown) {
  if (isNode(node) && node.type === 'VariableDeclaration' && node.kind !== 'var') {
    declareVariables(scope, node);
  }
}

function declareVariables(scope: Scope, declaration: AstNode) {
  for (const declarator of (declaration.declarations as AstNode[]) ?? []) {
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
    if (FUNCTION_TYPES.has(child.type)) continue;
    if (child.type === 'VariableDeclaration' && child.kind === 'var')
      declareVariables(scope, child);
    declareVars(scope, child);
  }
}

/** The scope a function opens: its own name if it's a named expression, its parameters, its body's. */
function functionScope(fn: AstNode): Scope {
  const scope: Scope = new Map();
  // A named function expression can call itself by its own name.
  if (fn.type === 'FunctionExpression') declareId(scope, fn.id, fn);
  for (const param of (fn.params as unknown[]) ?? []) declarePattern(scope, param);
  if (isNode(fn.body)) {
    declareVars(scope, fn.body);
    if (fn.body.type === 'BlockStatement') declareBlock(scope, fn.body.body as unknown[]);
  }
  return scope;
}

/** The scope a node `opensScope` says opens, with what it declares directly. */
function blockScope(node: AstNode): Scope {
  const scope: Scope = new Map();
  switch (node.type) {
    case 'Program':
      declareVars(scope, node);
      declareBlock(scope, node.body as unknown[]);
      break;
    case 'BlockStatement':
    case 'StaticBlock':
      declareBlock(scope, node.body as unknown[]);
      break;
    case 'SwitchStatement':
      for (const switchCase of (node.cases as AstNode[]) ?? []) {
        declareBlock(scope, switchCase.consequent as unknown[]);
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
  for (const member of (body.body as AstNode[]) ?? []) {
    if (member.computed || !isNode(member.key) || member.key.type !== 'Identifier') continue;
    const value = functionValue(member.value);
    if (value) members.set(member.key.name as string, value);
  }
  return members;
}

/** The name `f` a `this.f()` call is to, or undefined for any other callee. */
function thisMethod(callee: AstNode): string | undefined {
  const isThis =
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    isNode(callee.object) &&
    callee.object.type === 'ThisExpression';
  return isThis && isNode(callee.property) ? (callee.property.name as string) : undefined;
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
  const graph = new CallGraph(callerOf, scoredAt);
  graph.visit(program, null);
  return inCycles(graph.edges);
}

/** Walks a program, resolving each call it can to the function called, as edges between scored ones. */
class CallGraph<Fn> {
  /** For each scored function, the scored functions it calls. */
  readonly edges = new Map<Fn, Set<Fn>>();
  readonly callerOf: (node: AstNode) => Fn | undefined;
  readonly scoredAt: (node: AstNode) => Fn | undefined;
  /** The scopes around the node being visited, innermost last. */
  readonly scopes: Scope[] = [];
  /** The functions around the node being visited, innermost last. */
  readonly functions: AstNode[] = [];
  /** For each function on the way in, the class members its `this` reaches, or null. */
  readonly thisMembers: (Members | null)[] = [];

  constructor(
    callerOf: (node: AstNode) => Fn | undefined,
    scoredAt: (node: AstNode) => Fn | undefined,
  ) {
    this.callerOf = callerOf;
    this.scoredAt = scoredAt;
  }

  /** Visits `node`; `members` is what `this` reaches in a class member's function, or null. */
  visit(node: AstNode, members: Members | null) {
    if (node.type === 'CallExpression') this.visitCall(node);
    if (node.type === 'ClassBody') this.visitClassBody(node);
    else if (FUNCTION_TYPES.has(node.type)) this.visitFunction(node, members);
    else if (opensScope(node)) this.visitScope(node, members);
    else this.visitChildren(node, members);
  }

  visitChildren(node: AstNode, members: Members | null) {
    for (const child of children(node)) this.visit(child, members);
  }

  /** Adds an edge for a bare `f()` or a `this.f()`, to the function it resolves to. */
  visitCall(call: AstNode) {
    if (!isNode(call.callee)) return;
    const from = this.functions.at(-1);
    if (call.callee.type === 'Identifier')
      this.addEdge(from, this.lookup(call.callee.name as string));
    const method = thisMethod(call.callee);
    if (method !== undefined) this.addEdge(from, this.thisMembers.at(-1)?.get(method));
  }

  /** Visits each member of a class, with the class's methods and fields as its `this`. */
  visitClassBody(body: AstNode) {
    const own = classMembers(body);
    for (const member of (body.body as AstNode[]) ?? []) this.visitMember(member, own);
  }

  /** A class member: a method's or field's function gets the class as its `this`. */
  visitMember(member: AstNode, own: Members) {
    for (const child of children(member)) {
      const value = functionValue(child);
      if (value && child === member.value) this.visit(value, own);
      else this.visit(child, own);
    }
  }

  visitFunction(fn: AstNode, members: Members | null) {
    this.scopes.push(functionScope(fn));
    this.functions.push(fn);
    // An arrow keeps the `this` around it; any other function has its own.
    // A class field's arrow has the instance as its `this`, which `members` then gives.
    this.thisMembers.push(
      fn.type === 'ArrowFunctionExpression'
        ? (members ?? this.thisMembers.at(-1) ?? null)
        : members,
    );
    this.visitChildren(fn, null);
    this.thisMembers.pop();
    this.functions.pop();
    this.scopes.pop();
  }

  visitScope(node: AstNode, members: Members | null) {
    this.scopes.push(blockScope(node));
    this.visitChildren(node, members);
    this.scopes.pop();
  }

  /** What `name` is bound to in the nearest scope that declares it, or undefined if none does. */
  lookup(name: string) {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].has(name)) return this.scopes[i].get(name);
    }
    return undefined;
  }

  /** Records that the scored function `from` counts towards calls the one `to` is, if both are. */
  addEdge(from: AstNode | undefined, to: AstNode | null | undefined) {
    const source = from ? this.callerOf(from) : undefined;
    const target = to ? this.scoredAt(to) : undefined;
    if (source === undefined || target === undefined) return;
    let targets = this.edges.get(source);
    if (!targets) this.edges.set(source, (targets = new Set()));
    targets.add(target);
  }
}

/** The nodes in a cycle of `edges`: a component of more than one, or one with an edge to itself. */
function inCycles<Fn>(edges: Map<Fn, Set<Fn>>) {
  const components = new StronglyConnected(edges);
  for (const fn of edges.keys()) if (!components.index.has(fn)) components.connect(fn);
  return components.inCycles;
}

/** Tarjan's strongly-connected-components algorithm, keeping the components that are cycles. */
class StronglyConnected<Fn> {
  readonly edges: Map<Fn, Set<Fn>>;
  /** The order each node was reached in. */
  readonly index = new Map<Fn, number>();
  /** The earliest-reached node on the stack each node leads back to. */
  readonly low = new Map<Fn, number>();
  readonly stack: Fn[] = [];
  readonly onStack = new Set<Fn>();
  readonly inCycles = new Set<Fn>();

  constructor(edges: Map<Fn, Set<Fn>>) {
    this.edges = edges;
  }

  /** Searches from `fn`, closing each component the search finishes. */
  connect(fn: Fn) {
    const reached = this.index.size;
    this.index.set(fn, reached);
    this.low.set(fn, reached);
    this.stack.push(fn);
    this.onStack.add(fn);
    for (const next of this.edges.get(fn) ?? []) {
      if (!this.index.has(next)) {
        this.connect(next);
        this.lower(fn, this.low.get(next) as number);
      } else if (this.onStack.has(next)) {
        this.lower(fn, this.index.get(next) as number);
      }
    }
    if (this.low.get(fn) === reached) this.close(fn);
  }

  lower(fn: Fn, to: number) {
    this.low.set(fn, Math.min(this.low.get(fn) as number, to));
  }

  /** Pops `fn`'s component off the stack, keeping it if it's a cycle. */
  close(fn: Fn) {
    const component: Fn[] = [];
    let member: Fn;
    do {
      member = this.stack.pop() as Fn;
      this.onStack.delete(member);
      component.push(member);
    } while (member !== fn);
    if (component.length > 1 || this.edges.get(fn)?.has(fn)) {
      for (const m of component) this.inCycles.add(m);
    }
  }
}
