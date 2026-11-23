// Finds the scored functions in a recursion cycle: those that call themselves, or call a function
// that leads back to them. A call is resolved as JavaScript resolves it, within the file:
// - a bare `f()` to the function bound to `f` in the nearest enclosing scope, so a parameter or a
//   local of the same name hides it;
// - `this.f()` to a method or function-valued field of the class around the call, unless a
//   non-arrow function in between rebinds `this`.
// Calls through other objects, variables or files aren't followed. Why is in oxcrap.meta.md.
import { type AstNode, children, FUNCTION_TYPES, isNode } from './complexity.ts';

type Scope = Map<string, AstNode | null>;

/** The names a binding pattern, such as a parameter or a destructuring, declares. */
function boundNames(pattern: unknown, into: string[] = []): string[] {
  if (!isNode(pattern)) return into;
  if (pattern.type === 'Identifier') into.push(pattern.name as string);
  else if (pattern.type === 'AssignmentPattern') boundNames(pattern.left, into);
  else if (pattern.type === 'RestElement') boundNames(pattern.argument, into);
  else if (pattern.type === 'ArrayPattern') {
    for (const element of (pattern.elements as unknown[]) ?? []) boundNames(element, into);
  } else if (pattern.type === 'ObjectPattern') {
    for (const property of (pattern.properties as AstNode[]) ?? []) {
      boundNames(property.type === 'RestElement' ? property : property.value, into);
    }
  } else if (pattern.type === 'TSParameterProperty') boundNames(pattern.parameter, into);
  return into;
}

/** A declarator's function, for `const f = () => …` and `const f = function () {}`. */
function functionValue(node: unknown): AstNode | null {
  if (!isNode(node)) return null;
  if (node.type === 'ParenthesizedExpression') return functionValue(node.expression);
  return FUNCTION_TYPES.has(node.type) ? node : null;
}

/** Declares into `scope` what `statements` declare directly: functions, classes, let and const. */
function declareBlock(scope: Scope, statements: unknown[]) {
  for (let statement of statements) {
    if (!isNode(statement)) continue;
    if (
      /^Export(Named|Default)Declaration$/.test(statement.type) &&
      isNode(statement.declaration)
    ) {
      statement = statement.declaration;
    }
    if (!isNode(statement)) continue;
    if (statement.type === 'FunctionDeclaration' && isNode(statement.id)) {
      scope.set(statement.id.name as string, statement);
    } else if (statement.type === 'ClassDeclaration' && isNode(statement.id)) {
      scope.set(statement.id.name as string, null);
    } else if (statement.type === 'VariableDeclaration' && statement.kind !== 'var') {
      declareVariables(scope, statement);
    } else if (statement.type === 'ImportDeclaration') {
      for (const specifier of (statement.specifiers as AstNode[]) ?? []) {
        if (isNode(specifier.local)) scope.set(specifier.local.name as string, null);
      }
    }
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

/** A class body's methods and function-valued fields, by name. */
function classMembers(body: AstNode) {
  const members = new Map<string, AstNode>();
  for (const member of (body.body as AstNode[]) ?? []) {
    if (member.computed || !isNode(member.key) || member.key.type !== 'Identifier') continue;
    const value = functionValue(member.value);
    if (value) members.set(member.key.name as string, value);
  }
  return members;
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
  const edges = new Map<Fn, Set<Fn>>();
  const addEdge = (from: AstNode | undefined, to: AstNode | null | undefined) => {
    const source = from ? callerOf(from) : undefined;
    const target = to ? scoredAt(to) : undefined;
    if (source === undefined || target === undefined) return;
    if (!edges.has(source)) edges.set(source, new Set());
    edges.get(source)?.add(target);
  };

  const scopes: Scope[] = [];
  const functions: AstNode[] = [];
  /** For each function on the way in, the class members its `this` reaches, or null. */
  const thisMembers: (Map<string, AstNode> | null)[] = [];
  const lookup = (name: string) => {
    for (let i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i].has(name)) return scopes[i].get(name);
    }
    return undefined;
  };

  const visit = (node: AstNode, members: Map<string, AstNode> | null) => {
    if (node.type === 'CallExpression' && isNode(node.callee)) {
      const callee = node.callee;
      const from = functions.at(-1);
      if (callee.type === 'Identifier') addEdge(from, lookup(callee.name as string));
      if (
        callee.type === 'MemberExpression' &&
        !callee.computed &&
        isNode(callee.object) &&
        callee.object.type === 'ThisExpression' &&
        isNode(callee.property)
      ) {
        addEdge(from, thisMembers.at(-1)?.get(callee.property.name as string));
      }
    }

    if (node.type === 'ClassBody') {
      const own = classMembers(node);
      for (const member of (node.body as AstNode[]) ?? []) visitMember(member, own);
      return;
    }

    if (FUNCTION_TYPES.has(node.type)) {
      const scope: Scope = new Map();
      // A named function expression can call itself by its own name.
      if (node.type === 'FunctionExpression' && isNode(node.id))
        scope.set(node.id.name as string, node);
      for (const param of (node.params as unknown[]) ?? []) {
        for (const name of boundNames(param)) scope.set(name, null);
      }
      if (isNode(node.body)) {
        declareVars(scope, node.body);
        if (node.body.type === 'BlockStatement') declareBlock(scope, node.body.body as unknown[]);
      }
      scopes.push(scope);
      functions.push(node);
      // An arrow keeps the `this` around it; any other function has its own.
      // A class field's arrow has the instance as its `this`, which `members` then gives.
      thisMembers.push(
        node.type === 'ArrowFunctionExpression' ? (members ?? thisMembers.at(-1) ?? null) : members,
      );
      for (const child of children(node)) visit(child, null);
      thisMembers.pop();
      functions.pop();
      scopes.pop();
      return;
    }

    const block =
      node.type === 'BlockStatement' || node.type === 'StaticBlock' || node.type === 'Program';
    const loop = /^For(In|Of)?Statement$/.test(node.type);
    if (block || loop || node.type === 'CatchClause' || node.type === 'SwitchStatement') {
      const scope: Scope = new Map();
      if (node.type === 'Program') declareVars(scope, node);
      if (Array.isArray(node.body)) declareBlock(scope, node.body as unknown[]);
      if (node.type === 'SwitchStatement') {
        for (const switchCase of (node.cases as AstNode[]) ?? []) {
          declareBlock(scope, switchCase.consequent as unknown[]);
        }
      }
      if (node.type === 'CatchClause')
        for (const name of boundNames(node.param)) scope.set(name, null);
      const init = loop ? (node.init ?? node.left) : undefined;
      if (isNode(init) && init.type === 'VariableDeclaration' && init.kind !== 'var') {
        declareVariables(scope, init);
      }
      scopes.push(scope);
      for (const child of children(node)) visit(child, members);
      scopes.pop();
      return;
    }

    for (const child of children(node)) visit(child, members);
  };

  /** A class member: a method's or field's function gets the class as its `this`. */
  const visitMember = (member: AstNode, own: Map<string, AstNode>) => {
    for (const child of children(member)) {
      const value = functionValue(child);
      if (value && child === member.value) visit(value, own);
      else visit(child, own);
    }
  };

  visit(program, null);
  return inCycles(edges);
}

/** The nodes in a cycle of `edges`: a component of more than one, or one with an edge to itself. */
function inCycles<Fn>(edges: Map<Fn, Set<Fn>>) {
  const index = new Map<Fn, number>();
  const low = new Map<Fn, number>();
  const stack: Fn[] = [];
  const onStack = new Set<Fn>();
  const found = new Set<Fn>();
  let counter = 0;
  const connect = (fn: Fn) => {
    index.set(fn, counter);
    low.set(fn, counter);
    counter++;
    stack.push(fn);
    onStack.add(fn);
    for (const next of edges.get(fn) ?? []) {
      if (!index.has(next)) {
        connect(next);
        low.set(fn, Math.min(low.get(fn) as number, low.get(next) as number));
      } else if (onStack.has(next)) {
        low.set(fn, Math.min(low.get(fn) as number, index.get(next) as number));
      }
    }
    if (low.get(fn) === index.get(fn)) {
      const component: Fn[] = [];
      let member: Fn;
      do {
        member = stack.pop() as Fn;
        onStack.delete(member);
        component.push(member);
      } while (member !== fn);
      if (component.length > 1 || edges.get(fn)?.has(fn)) for (const m of component) found.add(m);
    }
  };
  for (const fn of edges.keys()) if (!index.has(fn)) connect(fn);
  return found;
}
