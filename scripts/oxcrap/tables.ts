// Finds a module's static lookup tables, and counts the reads of them that stand for branches. A
// table controls flow when a read decides which code runs: a dispatch table, whose entries hold a
// function, read with a runtime key, counts like a switch; and a membership test, `.has`,
// `.includes` or `in`, counts like an `||` chain. A table of plain values only decides which value
// comes back, so reading it counts nothing. Why is in oxcrap.meta.md, "Lookup tables count".
import { type AstNode, type Counting, isNode } from './complexity.ts';

/** A static table: what holds it, how many entries, and whether any entry holds a function. */
export type Table = {
  kind: 'set' | 'map' | 'object' | 'array';
  entries: number;
  dispatch: boolean;
};
/** A module's tables, by the name a read uses. */
export type Tables = Map<string, Table>;
/** A name a module imports from a relative path: `import { imported as local } from from`. */
export type Import = { local: string; imported: string; from: string };

/** What a module's top level holds: its own tables by local name, what it exports, and imports. */
export type ModuleTables = { own: Tables; exported: Tables; imports: Import[] };

/** `node` without the wrappers that don't change its value: parentheses, `as`, `satisfies`, `!`. */
function unwrap(node: unknown): unknown {
  if (!isNode(node)) return node;
  switch (node.type) {
    case 'ParenthesizedExpression':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
      return unwrap(node.expression);
    default:
      return node;
  }
}

/** The elements of an array literal, or nothing if it has a spread or a hole, so its size isn't fixed. */
function literalElements(node: unknown): AstNode[] | undefined {
  const array = unwrap(node);
  if (!isNode(array) || array.type !== 'ArrayExpression') return undefined;
  const elements = array.elements as unknown[];
  const fixed = elements.every((element) => isNode(element) && element.type !== 'SpreadElement');
  return fixed ? (elements as AstNode[]) : undefined;
}

/** The names of the functions a module declares at its top level, by declaration or `const`. */
function functionNames(program: AstNode): Set<string> {
  const names = new Set<string>();
  for (const statement of topLevel(program)) {
    if (statement.type === 'FunctionDeclaration' && isNode(statement.id)) {
      names.add(statement.id.name as string);
    }
    for (const [name, value] of constants(statement)) if (isFunction(value)) names.add(name);
  }
  return names;
}

/** Whether `node` is a function literal. */
function isFunction(node: unknown): boolean {
  const value = unwrap(node);
  if (!isNode(value)) return false;
  return value.type === 'ArrowFunctionExpression' || value.type === 'FunctionExpression';
}

/** Whether `node` holds a function: is one, names one, or holds one in an object or array. */
function holdsFunction(node: unknown, functions: Set<string>): boolean {
  const value = unwrap(node);
  if (!isNode(value)) return false;
  if (isFunction(value)) return true;
  switch (value.type) {
    case 'Identifier':
      return functions.has(value.name as string);
    case 'ObjectExpression':
      return (value.properties as AstNode[]).some(
        (p) => p.method === true || holdsFunction(p.value, functions),
      );
    case 'ArrayExpression':
      return (value.elements as unknown[]).some((element) => holdsFunction(element, functions));
    default:
      return false;
  }
}

/** The table `init` builds, if it's a literal one: `new Set([…])`, `new Map([[k, v], …])`, `{…}` or `[…]`. */
function tableOf(init: unknown, functions: Set<string>): Table | undefined {
  const value = unwrap(init);
  if (!isNode(value)) return undefined;
  switch (value.type) {
    case 'NewExpression':
      return collectionOf(value, functions);
    case 'ObjectExpression':
      return objectOf(value, functions);
    case 'ArrayExpression': {
      const elements = literalElements(value);
      if (!elements) return undefined;
      const dispatch = elements.some((element) => holdsFunction(element, functions));
      return { kind: 'array', entries: elements.length, dispatch };
    }
    case 'CallExpression':
      // `Object.freeze({…})` is the table it freezes.
      return isFreeze(value) ? tableOf((value.arguments as unknown[])[0], functions) : undefined;
    default:
      return undefined;
  }
}

/** Whether `call` is `Object.freeze(…)`. */
function isFreeze(call: AstNode) {
  const callee = call.callee;
  return (
    isNode(callee) &&
    callee.type === 'MemberExpression' &&
    isNode(callee.object) &&
    callee.object.name === 'Object' &&
    isNode(callee.property) &&
    callee.property.name === 'freeze'
  );
}

/** `new Set([…])` or `new Map([[k, v], …])` with literal entries. */
function collectionOf(expression: AstNode, functions: Set<string>): Table | undefined {
  const callee = expression.callee;
  const name = isNode(callee) ? callee.name : undefined;
  const elements = literalElements((expression.arguments as unknown[])[0]);
  if (!elements) return undefined;
  if (name === 'Set') return { kind: 'set', entries: elements.length, dispatch: false };
  if (name !== 'Map') return undefined;
  const pairs = elements.map((element) => literalElements(element));
  if (!pairs.every((pair) => pair?.length === 2)) return undefined;
  const dispatch = pairs.some((pair) => holdsFunction(pair?.[1], functions));
  return { kind: 'map', entries: elements.length, dispatch };
}

/** An object literal with no spread, whose size is fixed. */
function objectOf(object: AstNode, functions: Set<string>): Table | undefined {
  const properties = object.properties as AstNode[];
  if (properties.some((property) => property.type !== 'Property')) return undefined;
  const dispatch = properties.some(
    (property) => property.method === true || holdsFunction(property.value, functions),
  );
  return { kind: 'object', entries: properties.length, dispatch };
}

/** A module's top-level statements, with `export` taken off a declaration. */
function topLevel(program: AstNode): AstNode[] {
  return (program.body as AstNode[]).map((statement) =>
    statement.type === 'ExportNamedDeclaration' && isNode(statement.declaration)
      ? statement.declaration
      : statement,
  );
}

/** The `const` names a statement declares with a value, and those values. */
function constants(statement: AstNode): [string, unknown][] {
  if (statement.type !== 'VariableDeclaration' || statement.kind !== 'const') return [];
  return (statement.declarations as AstNode[]).flatMap((declarator) =>
    isNode(declarator.id) && declarator.id.type === 'Identifier'
      ? [[declarator.id.name as string, declarator.init] as [string, unknown]]
      : [],
  );
}

/**
 * An entry a top-level statement adds to one of `tables`: `T.set(k, v)`, `T.add(x)`, or
 * `T.k = v`. Returns the table's name and the value added, or nothing.
 */
function addition(statement: AstNode): { name: string; value: unknown } | undefined {
  if (statement.type !== 'ExpressionStatement' || !isNode(statement.expression)) return undefined;
  const expression = statement.expression;
  switch (expression.type) {
    case 'AssignmentExpression':
      return assigned(expression);
    case 'CallExpression':
      return added(expression);
    default:
      return undefined;
  }
}

/** `T.k = v` or `T[k] = v`: the table's name and the value. */
function assigned(assignment: AstNode) {
  const target = assignment.left;
  if (!isNode(target) || target.type !== 'MemberExpression' || !isNode(target.object)) {
    return undefined;
  }
  return { name: target.object.name as string, value: assignment.right };
}

/** `T.set(k, v)` or `T.add(x)`: the table's name and the value. */
function added(call: AstNode) {
  const callee = call.callee;
  if (!isNode(callee) || callee.type !== 'MemberExpression' || !isNode(callee.object)) {
    return undefined;
  }
  const name = callee.object.name as string;
  const args = call.arguments as unknown[];
  switch (isNode(callee.property) ? callee.property.name : undefined) {
    case 'set':
      return { name, value: args[1] };
    case 'add':
      return { name, value: args[0] };
    default:
      return undefined;
  }
}

/** The names a module imports from relative paths. */
function importsOf(program: AstNode): Import[] {
  return (program.body as AstNode[]).flatMap((statement) => {
    if (statement.type !== 'ImportDeclaration' || !isNode(statement.source)) return [];
    const from = statement.source.value as string;
    if (!from.startsWith('./') && !from.startsWith('../')) return [];
    return (statement.specifiers as AstNode[]).flatMap((specifier) =>
      specifier.type === 'ImportSpecifier' && isNode(specifier.imported) && isNode(specifier.local)
        ? [
            {
              local: specifier.local.name as string,
              imported: specifier.imported.name as string,
              from,
            },
          ]
        : [],
    );
  });
}

/** The tables a module exports, by the name another module imports them as. */
function exportsOf(program: AstNode, own: Tables): Tables {
  return new Map((program.body as AstNode[]).flatMap((statement) => exportedFrom(statement, own)));
}

/** The tables one statement exports: `export const T = …`, or `export { T as U }`. */
function exportedFrom(statement: AstNode, own: Tables): [string, Table][] {
  if (statement.type !== 'ExportNamedDeclaration' || statement.source) return [];
  const declared = isNode(statement.declaration)
    ? constants(statement.declaration).map(([name]) => [name, name])
    : [];
  const specified = ((statement.specifiers as AstNode[]) ?? []).flatMap((specifier) =>
    isNode(specifier.local) && isNode(specifier.exported)
      ? [[specifier.local.name as string, specifier.exported.name as string]]
      : [],
  );
  return [...declared, ...specified].flatMap(([local, name]) => {
    const table = own.get(local);
    return table ? [[name, table] as [string, Table]] : [];
  });
}

/** A module's static tables: `const`s built from literals, with what its top level adds to them. */
export function tablesIn(program: AstNode): ModuleTables {
  const functions = functionNames(program);
  const own: Tables = new Map();
  const statements = topLevel(program);
  for (const statement of statements) {
    for (const [name, init] of constants(statement)) {
      const table = tableOf(init, functions);
      if (table) own.set(name, table);
    }
  }
  for (const statement of statements) {
    const added = addition(statement);
    const table = added && own.get(added.name);
    if (!table || !added) continue;
    own.set(added.name, {
      ...table,
      entries: table.entries + 1,
      dispatch: table.dispatch || holdsFunction(added.value, functions),
    });
  }
  return { own, exported: exportsOf(program, own), imports: importsOf(program) };
}

/** Whether `node` is a key known before the program runs: a literal, or a template with no `${}`. */
function staticKey(node: unknown): boolean {
  if (!isNode(node)) return false;
  if (node.type === 'Literal') return true;
  return node.type === 'TemplateLiteral' && (node.expressions as unknown[]).length === 0;
}

/** What a membership test over `entries` adds, as the `||` chain it stands for would. */
function membership(entries: number, counting: Counting) {
  if (counting.logicalOperators === 'each') return Math.max(entries - 1, 0);
  return entries > 1 ? 1 : 0;
}

/** What a dispatch over `entries` adds, as the switch it stands for would. */
function dispatch(entries: number, counting: Counting) {
  if (counting.switchCases === 'each') return entries;
  return entries > 0 ? 1 : 0;
}

/** The table an expression names, if it's one of `tables`. */
function tableNamed(node: unknown, tables: Tables): Table | undefined {
  return isNode(node) && node.type === 'Identifier' ? tables.get(node.name as string) : undefined;
}

/** What a method call on a table adds: `.has` and `.includes` as membership, `.get` as dispatch. */
function methodAdds(call: AstNode, tables: Tables, counting: Counting) {
  const callee = call.callee as AstNode;
  const table = tableNamed(callee.object, tables);
  if (!table || !isNode(callee.property)) return 0;
  switch (callee.property.name) {
    case 'has':
      return table.kind === 'set' || table.kind === 'map' ? membership(table.entries, counting) : 0;
    case 'includes':
      return table.kind === 'array' ? membership(table.entries, counting) : 0;
    case 'get':
      return getAdds(call, table, counting);
    default:
      return 0;
  }
}

/** `T.get(k)` on a dispatch Map, with a runtime key, counts as the switch it stands for. */
function getAdds(call: AstNode, table: Table, counting: Counting) {
  const key = (call.arguments as unknown[])[0];
  if (table.kind !== 'map' || !table.dispatch || staticKey(key)) return 0;
  return dispatch(table.entries, counting);
}

/**
 * What a call adds: a method on a table, or 1 for a call through a computed member with a runtime
 * key, `x[k]()` or `this[name]()`, unless `x` is a dispatch table, whose read counts already.
 */
function callAdds(call: AstNode, tables: Tables, counting: Counting) {
  const callee = call.callee;
  if (!isNode(callee) || callee.type !== 'MemberExpression') return 0;
  if (!callee.computed) return methodAdds(call, tables, counting);
  if (staticKey(callee.property)) return 0;
  return tableNamed(callee.object, tables)?.dispatch ? 0 : 1;
}

/**
 * How many paths `node` adds by reading one of `tables`, as the switch or `||` chain it stands for
 * would. 0 for any other node.
 */
export function lookupAdds(node: AstNode, tables: Tables, counting: Counting) {
  switch (node.type) {
    case 'CallExpression':
      return callAdds(node, tables, counting);
    case 'MemberExpression':
      return indexAdds(node, tables, counting);
    case 'BinaryExpression':
      return inAdds(node, tables, counting);
    default:
      return 0;
  }
}

/** `T[k]`: a dispatch object or array read with a runtime key, as the switch it stands for. */
function indexAdds(member: AstNode, tables: Tables, counting: Counting) {
  const table = tableNamed(member.object, tables);
  if (!member.computed || !table?.dispatch || staticKey(member.property)) return 0;
  return table.kind === 'object' || table.kind === 'array' ? dispatch(table.entries, counting) : 0;
}

/** `k in T`: membership of an object's keys, as the `||` chain it stands for. */
function inAdds(binary: AstNode, tables: Tables, counting: Counting) {
  const table = binary.operator === 'in' ? tableNamed(binary.right, tables) : undefined;
  return table?.kind === 'object' ? membership(table.entries, counting) : 0;
}

/**
 * The tables a module can read: its own, and those it imports from relative paths, which
 * `imported(from, name)` looks up in the module `from`. Its own come first, as a local name hides
 * an import of the same name only by being an error.
 */
export function readableTables(
  module: ModuleTables,
  imported: (from: string, name: string) => Table | undefined,
): Tables {
  const tables: Tables = new Map();
  for (const { local, imported: name, from } of module.imports) {
    const table = imported(from, name);
    if (table) tables.set(local, table);
  }
  for (const [name, table] of module.own) tables.set(name, table);
  return tables;
}
