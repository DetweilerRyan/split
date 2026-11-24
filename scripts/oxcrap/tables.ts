// Finds a module's static lookup tables, and counts the reads of them that stand for branches. A
// table controls flow when a read decides which code runs: a dispatch table, whose entries hold a
// function, read with a runtime key, counts like a switch; and a membership test, `.has`,
// `.includes` or `in`, counts like an `||` chain. A table of plain values only decides which value
// comes back, so reading it counts nothing. Why is in oxcrap.meta.md, "Lookup tables count".
import { type AstNode, children, type Counting, isFunctionType, isNode } from './complexity.ts';
import { shadowedUses } from './recursion.ts';

/** A static table: what holds it, how many entries, and whether any entry holds a function. */
export type Table = {
  readonly kind: 'set' | 'map' | 'object' | 'array';
  readonly entries: number;
  readonly dispatch: boolean;
};
/** A module's tables, by the name a read uses. */
export type Tables = ReadonlyMap<string, Table>;
/** A name a module imports from a relative path: `import { imported as local } from from`. */
export type Import = { readonly local: string; readonly imported: string; readonly from: string };

/** What a module exports that another's tables can use: its tables, and its functions' names. */
export type Exports = { readonly tables: Tables; readonly functions: ReadonlySet<string> };
/** The exports of the module a relative import names, `from` as the file writes it, if it's found. */
export type Imported = (from: string) => Exports | undefined;

/**
 * The tables a module's functions can read, by name, and the uses of those names that a local
 * binding hides, which don't read the table.
 */
export type Readable = { readonly tables: Tables; readonly shadowed: ReadonlySet<AstNode> };

/**
 * What a module's top level holds: its own tables by local name, the tables it can read (its own
 * and those it imports), what it exports, and its imports.
 */
export type ModuleTables = {
  readonly own: Tables;
  readonly readable: Readable;
  readonly exported: Exports;
  readonly imports: readonly Import[];
};

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
function literalElements(node: unknown): readonly AstNode[] | undefined {
  const array = unwrap(node);
  if (!isNode(array) || array.type !== 'ArrayExpression') return undefined;
  const elements = array.elements as readonly unknown[];
  const fixed = elements.every((element) => isNode(element) && element.type !== 'SpreadElement');
  return fixed ? (elements as readonly AstNode[]) : undefined;
}

/** The names of the functions a module declares at its top level, by declaration or `const`. */
function functionNames(program: AstNode): ReadonlySet<string> {
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
function holdsFunction(node: unknown, functions: ReadonlySet<string>): boolean {
  const value = unwrap(node);
  if (!isNode(value)) return false;
  if (isFunction(value)) return true;
  switch (value.type) {
    case 'Identifier':
      return functions.has(value.name as string);
    case 'ObjectExpression':
      return (value.properties as readonly AstNode[]).some((p) =>
        holdsFunction(p.value, functions),
      );
    case 'ArrayExpression':
      return (value.elements as readonly unknown[]).some((element) =>
        holdsFunction(element, functions),
      );
    default:
      return false;
  }
}

/** The table `init` builds, if it's a literal one: `new Set([…])`, `new Map([[k, v], …])`, `{…}` or `[…]`. */
function tableOf(init: unknown, functions: ReadonlySet<string>): Table | undefined {
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
      return isFreeze(value)
        ? tableOf((value.arguments as readonly unknown[])[0], functions)
        : undefined;
  }
  return undefined;
}

/** Whether `call` is `Object.freeze(…)`. */
function isFreeze(call: AstNode) {
  const callee = call.callee as AstNode;
  return (
    isNode(callee.object) &&
    callee.object.name === 'Object' &&
    isNode(callee.property) &&
    callee.property.name === 'freeze'
  );
}

/** `new Set([…])` or `new Map([[k, v], …])` with literal entries. */
function collectionOf(expression: AstNode, functions: ReadonlySet<string>): Table | undefined {
  const callee = expression.callee;
  const name = isNode(callee) ? callee.name : undefined;
  const elements = literalElements((expression.arguments as readonly unknown[])[0]);
  if (!elements) return undefined;
  if (name === 'Set') return { kind: 'set', entries: elements.length, dispatch: false };
  if (name !== 'Map') return undefined;
  const pairs = elements.map((element) => literalElements(element));
  if (!pairs.every((pair) => pair?.length === 2)) return undefined;
  const dispatch = (pairs as readonly (readonly AstNode[])[]).some((pair) =>
    holdsFunction(pair[1], functions),
  );
  return { kind: 'map', entries: elements.length, dispatch };
}

/** An object literal with no spread, whose size is fixed. */
function objectOf(object: AstNode, functions: ReadonlySet<string>): Table | undefined {
  const properties = object.properties as readonly AstNode[];
  if (properties.some((property) => property.type !== 'Property')) return undefined;
  const dispatch = properties.some((property) => holdsFunction(property.value, functions));
  return { kind: 'object', entries: properties.length, dispatch };
}

/**
 * A module's top-level statements, with `export` and `export default` taken off what they export,
 * and an expression statement or `export =` as its expression.
 */
function topLevel(program: AstNode): readonly AstNode[] {
  return (program.body as readonly AstNode[]).map((statement) => {
    // Only an export has a `declaration`, and only `x;` or `export = x` an `expression` node.
    const inner = statement.declaration ?? statement.expression;
    return isNode(inner) ? inner : statement;
  });
}

/** The `const` names a statement declares with a value, and those values. */
function constants(statement: AstNode): readonly (readonly [string, unknown])[] {
  // Only a VariableDeclaration has a `kind` of 'const'.
  if (statement.kind !== 'const') return [];
  return (statement.declarations as readonly AstNode[]).flatMap((declarator) =>
    isNode(declarator.id) && declarator.id.type === 'Identifier'
      ? [[declarator.id.name as string, declarator.init] as readonly [string, unknown]]
      : [],
  );
}

/**
 * An entry a top-level expression adds to one of `tables`: `T.set(k, v)`, `T.add(x)`, or
 * `T.k = v`, as a statement or exported. Returns the table's name and the value added, or nothing.
 */
function addition(
  expression: AstNode,
): { readonly name: string; readonly value: unknown } | undefined {
  switch (expression.type) {
    case 'AssignmentExpression':
      return assigned(expression);
    case 'CallExpression':
      return added(expression);
  }
  return undefined;
}

/** `T.k = v` or `T[k] = v`: the table's name and the value. */
function assigned(assignment: AstNode) {
  // Only a MemberExpression has an `object`.
  const target = assignment.left as AstNode;
  if (!isNode(target.object)) return undefined;
  return { name: target.object.name as string, value: assignment.right };
}

/** `T.set(k, v)` or `T.add(x)`: the table's name and the value. */
function added(call: AstNode) {
  // Only a MemberExpression has an `object`.
  const callee = call.callee as AstNode;
  if (!isNode(callee.object)) return undefined;
  const name = callee.object.name as string;
  const args = call.arguments as readonly unknown[];
  switch (isNode(callee.property) ? callee.property.name : undefined) {
    case 'set':
      return { name, value: args[1] };
    case 'add':
      return { name, value: args[0] };
  }
  return undefined;
}

/** The names a module imports from relative paths. */
function importsOf(program: AstNode): readonly Import[] {
  return (program.body as readonly AstNode[]).flatMap((statement) => {
    if (statement.type !== 'ImportDeclaration' || !isNode(statement.source)) return [];
    const from = statement.source.value as string;
    if (!/^\.\.?(\/|$)/.test(from)) return [];
    // Only an ImportSpecifier has an `imported` name: a default or namespace import has none.
    return (statement.specifiers as readonly AstNode[]).flatMap((specifier) =>
      isNode(specifier.imported) && isNode(specifier.local)
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
function exportsOf(program: AstNode, own: Tables, functions: ReadonlySet<string>): Exports {
  const names = (program.body as readonly AstNode[]).flatMap(exportedNames);
  const tables = new Map<string, Table>();
  const exportedFunctions = new Set<string>();
  for (const [local, name] of names) {
    const table = own.get(local);
    if (table) tables.set(name, table);
    if (functions.has(local)) exportedFunctions.add(name);
  }
  return { tables, functions: exportedFunctions };
}
/** The names one statement exports, local then exported: `export const T`, `export { T as U }`. */
function exportedNames(statement: AstNode): readonly (readonly [string, string])[] {
  if (statement.type !== 'ExportNamedDeclaration' || statement.source) return [];
  const declaration = statement.declaration;
  const declared: [string, string][] = isNode(declaration)
    ? declaredNames(declaration).map((name) => [name, name])
    : [];
  const specified = (statement.specifiers as readonly AstNode[]).map(
    (specifier) =>
      [(specifier.local as AstNode).name, (specifier.exported as AstNode).name] as readonly [
        string,
        string,
      ],
  );
  return [...declared, ...specified];
}

/** The names an exported declaration declares: a function's, or its `const`s. */
function declaredNames(declaration: AstNode): readonly string[] {
  // An exported function declaration always has a name.
  if (declaration.type === 'FunctionDeclaration')
    return [(declaration.id as AstNode).name as string];
  return constants(declaration).map(([name]) => name);
}
/** A module's static tables: `const`s built from literals, with what its top level adds to them. */
export function tablesIn(program: AstNode, imported: Imported = () => undefined): ModuleTables {
  const imports = importsOf(program);
  const ownFunctions = functionNames(program);
  const functions = new Set([...ownFunctions, ...importedFunctions(imports, imported)]);
  const own = new Map(staticTables(program, functions));
  const tables = new Map<string, Table>();
  for (const { local, imported: name, from } of imports) {
    const table = imported(from)?.tables.get(name);
    if (table) tables.set(local, table);
  }
  for (const [name, table] of own) tables.set(name, table);
  const shadowed = shadowedUses(program, new Set(tables.keys()));
  // A table a function here changes is state, whether it's this module's or imported.
  for (const name of mutatedInFunctions(program, shadowed, new Set())) {
    own.delete(name);
    tables.delete(name);
  }
  return {
    own,
    readable: { tables, shadowed },
    exported: exportsOf(program, own, ownFunctions),
    imports,
  };
}

/** The local names of the functions a module imports from modules that export them. */
function importedFunctions(imports: readonly Import[], imported: Imported): readonly string[] {
  return imports
    .filter(({ imported: name, from }) => imported(from)?.functions.has(name))
    .map(({ local }) => local);
}

/** The module's `const` tables built from literals, with what its top level adds to them. */
function staticTables(
  program: AstNode,
  functions: ReadonlySet<string>,
): ReadonlyMap<string, Table> {
  const own = new Map<string, Table>();
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
  return own;
}

/**
 * The names whose entries code inside a function changes: `T.k = v`, `T[k] = v`, `T.k++`,
 * `delete T[k]`, or a method that changes a Set, Map or array. Such a table is state, not a
 * table, so it isn't counted.
 */
function mutatedInFunctions(
  node: AstNode,
  shadowed: ReadonlySet<AstNode>,
  // oxlint-disable-next-line readonly/types -- the set the walk adds to in place, so each level of the tree takes one stack frame.
  into: Set<string>,
  inFunction = false,
): ReadonlySet<string> {
  const inside = inFunction || isFunctionType(node.type);
  const changed = inside ? mutatedName(node) : undefined;
  // A local of the same name is another object.
  if (changed && !shadowed.has(changed)) into.add(changed.name as string);
  for (const child of children(node)) mutatedInFunctions(child, shadowed, into, inside);
  return into;
}

/** The name, as written, of the object `node` changes an entry of, if it does. */
function mutatedName(node: AstNode): AstNode | undefined {
  switch (node.type) {
    case 'AssignmentExpression':
      return objectName(node.left as AstNode);
    case 'UpdateExpression':
      return objectName(node.argument as AstNode);
    case 'UnaryExpression':
      return node.operator === 'delete' ? objectName(node.argument as AstNode) : undefined;
    case 'CallExpression':
      return mutatorCallee(node.callee as AstNode);
  }
  return undefined;
}

/**
 * The name a member expression reads from, through casts: `T` in `(T as X)[k]`. Any other node has
 * no `object`, so it names nothing.
 */
function objectName(node: AstNode): AstNode | undefined {
  const object = unwrap((unwrap(node) as AstNode).object);
  // Stryker disable next-line ConditionalExpression: any other object has no `name`, so it names no table and no local, and adds nothing the caller keeps.
  return isNode(object) && object.type === 'Identifier' ? object : undefined;
}

/** The object a call changes through one of its methods, as `T` in `T.set(k, v)`. */
function mutatorCallee(callee: AstNode): AstNode | undefined {
  if (!isNode(callee.property)) return undefined;
  return isMutator(callee.property.name as string) ? objectName(callee) : undefined;
}

/** Whether a method changes the Set, Map or array it's called on. */
// @crap-allow CRAP 14, complexity 14. One list of the methods that change a collection: splitting it would scatter one idea, and a Set of them would count the same (#82).
function isMutator(method: string) {
  switch (method) {
    case 'set':
    case 'add':
    case 'delete':
    case 'clear':
    case 'push':
    case 'pop':
    case 'shift':
    case 'unshift':
    case 'splice':
    case 'sort':
    case 'reverse':
    case 'fill':
    case 'copyWithin':
      return true;
    // Stryker disable next-line ConditionalExpression: an empty default returns undefined, which the only caller treats as false.
    default:
      return false;
  }
}
/**
 * Whether `node` is a key known before the program runs: a literal, a template with no `${}`, or
 * none at all, as in `T.get()`, which reads `undefined`.
 */
function staticKey(node: unknown): boolean {
  if (!isNode(node)) return true;
  if (node.type === 'Literal') return true;
  return node.type === 'TemplateLiteral' && (node.expressions as readonly unknown[]).length === 0;
}

/** What a membership test over `entries` adds, as the `||` chain it stands for would. */
function membership(entries: number, counting: Counting) {
  if (counting.logicalOperators === 'each') return Math.max(entries - 1, 0);
  return entries > 1 ? 1 : 0;
}

/** What a dispatch over `entries` adds, as the switch it stands for would. */
function dispatch(entries: number, counting: Counting) {
  // A dispatch table holds a function in at least one entry.
  if (counting.switchCases === 'each') return entries;
  return 1;
}

/** The table an expression names, if it's one of `tables`. Only an Identifier has a `name`. */
function tableNamed(node: unknown, readable: Readable): Table | undefined {
  const value = unwrap(node);
  if (!isNode(value) || readable.shadowed.has(value)) return undefined;
  return readable.tables.get(value.name as string);
}

/** What a method call on a table adds: `.has` and `.includes` as membership, `.get` as dispatch. */
function methodAdds(call: AstNode, readable: Readable, counting: Counting) {
  const callee = call.callee as AstNode;
  const table = tableNamed(callee.object, readable);
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
  const key = (call.arguments as readonly unknown[])[0];
  if (table.kind !== 'map' || !table.dispatch || staticKey(key)) return 0;
  return dispatch(table.entries, counting);
}

/**
 * What a call adds: a method on a table, or 1 for a call through a computed member with a runtime
 * key, `x[k]()` or `this[name]()`, unless `x` is a dispatch table, whose read counts already.
 */
function callAdds(call: AstNode, readable: Readable, counting: Counting) {
  // A callee other than a member has no `object`, so methodAdds finds no table in it.
  const callee = call.callee as AstNode;
  if (!callee.computed) return methodAdds(call, readable, counting);
  if (staticKey(callee.property)) return 0;
  return tableNamed(callee.object, readable)?.dispatch ? 0 : 1;
}

/**
 * How many paths `node` adds by reading one of `tables`, as the switch or `||` chain it stands for
 * would. 0 for any other node.
 */
export function lookupAdds(node: AstNode, readable: Readable, counting: Counting) {
  switch (node.type) {
    case 'CallExpression':
      return callAdds(node, readable, counting);
    case 'MemberExpression':
      return indexAdds(node, readable, counting);
    case 'BinaryExpression':
      return inAdds(node, readable, counting);
    default:
      return 0;
  }
}

/** `T[k]`: a dispatch object or array read with a runtime key, as the switch it stands for. */
function indexAdds(member: AstNode, readable: Readable, counting: Counting) {
  const table = tableNamed(member.object, readable);
  if (!member.computed || !table?.dispatch || staticKey(member.property)) return 0;
  return table.kind === 'object' || table.kind === 'array' ? dispatch(table.entries, counting) : 0;
}

/** `k in T`: membership of an object's keys, as the `||` chain it stands for. */
function inAdds(binary: AstNode, readable: Readable, counting: Counting) {
  const table = binary.operator === 'in' ? tableNamed(binary.right, readable) : undefined;
  return table?.kind === 'object' ? membership(table.entries, counting) : 0;
}
