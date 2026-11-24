import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type Counting } from './complexity.ts';
import { moduleExports, parse } from './functions.ts';
import type { Imported } from './tables.ts';

// A switch moved into a table, or an `||` chain moved into a Set, must score as it did: that's the
// move tables.ts exists to see through. Each run writes the table one way of many, and adds code
// that must, or must not, change the answer. The answer comes from code with no table at all,
// never from tables.ts:
// - **Where the table lives:** in the file, imported whole, or with its handlers imported.
// - **How its handlers are written:** as arrows in the table, or every entry naming one function
//   the file declares, exports or default-exports.
// - **How its last entry gets in:** in the literal, or added by the top level, as a statement, with
//   `export =` or with `export default`.
// - **How it's read:** plainly or through a cast, with a runtime key or, for a dispatch, a static
//   one or none, which reads as no table.
// - **Decoy functions:** they read the table, change another object, or change the table, in the
//   file or in the table's own module. A table something changes is state, so it reads as no table.
// - **A local of the same name:** a parameter, a `const`, or a hoisted `var` hides the table, so
//   it reads as no table; one in a sibling block doesn't hide it.

/** Dispatch tables stand for a switch; membership tests for an `||` chain. */
type Kind = 'object' | 'map' | 'set' | 'array' | 'in';
type Placement = 'same' | 'importedTable' | 'importedHandlers' | 'namedHandler';
/** How a module declares the one function every entry names, in the `namedHandler` placement. */
type Handler = 'function' | 'exported' | 'defaultExported' | 'defaultAsync' | 'const';
/** Where the last entry comes from: the literal, or a top-level add written one of these ways. */
type Added = 'literal' | 'statement' | 'exportAssignment' | 'exportDefault';
type Cast = 'none' | 'any' | 'record' | 'parens' | 'nonNull';
type Decoy = {
  readonly where: 'main' | 'other';
  readonly does: 'read' | 'changeOther' | 'changeTable';
  readonly form: number;
};
type Shadow = 'none' | 'param' | 'local' | 'hoistedVar' | 'siblingBlock';
type Case = {
  readonly names: readonly string[];
  readonly kind: Kind;
  readonly placement: Placement;
  readonly handler: Handler;
  readonly added: Added;
  readonly cast: Cast;
  readonly key: number;
  readonly decoys: readonly Decoy[];
  readonly shadow: Shadow;
};

const countings: fc.Arbitrary<Counting> = fc.record({
  nestedFunctions: fc.constantFrom('enclosing' as const, 'own' as const),
  defaultValues: fc.boolean(),
  optionalChaining: fc.boolean(),
  switchCases: fc.constantFrom('each' as const, 'once' as const),
  logicalOperators: fc.constantFrom('each' as const, 'sequence' as const),
  recursion: fc.boolean(),
  labelledJumps: fc.boolean(),
  lookupTables: fc.constant(true),
});

/** 1 to 8 distinct keys, as identifiers so they work as object keys and strings alike. */
const keys = fc.uniqueArray(fc.stringMatching(/^k[a-z0-9]{0,5}$/), { minLength: 1, maxLength: 8 });

const CHANGES_TO_TABLE: readonly string[] = [
  '(T as any)[x] = 1;',
  'T[x] = 1;',
  '(T as any).k0 = 1;',
  '(T as any)[x]++;',
  'delete (T as any)[x];',
  '(T as any).add(x);',
  '(T as any).set(x, 1);',
  '(T as any).push(x);',
  '(T as any).clear();',
  '(T as any).delete(x);',
  '(T as any).pop();',
  '(T as any).shift();',
  '(T as any).unshift(x);',
  '(T as any).splice(0, 1);',
  '(T as any).sort();',
  '(T as any).reverse();',
  '(T as any).fill(x);',
  '(T as any).copyWithin(0, 1);',
];
/** Reads of the table that look like changes, or sit beside one, and leave it a table. */
const READS_OF_TABLE: readonly string[] = [
  'return (T as any)[x];',
  'return typeof (T as any)[x];',
  'return !(T as any)[x];',
  'return -(T as any).size;',
];
const CHANGES_TO_OTHER: readonly string[] = [
  'other.set(x, 1);',
  'other[x] = 1;',
  'delete other[x];',
];

/** How the named handler is declared, and how the last entry gets in: one `export default` at most. */
const handlerAndAdded = fc
  .constantFrom<Handler>('function', 'exported', 'defaultExported', 'defaultAsync', 'const')
  .chain((handler) =>
    fc.record({
      handler: fc.constant(handler),
      added: fc.constantFrom<Added>(
        'literal',
        'statement',
        'exportAssignment',
        ...(handler.startsWith('default') ? [] : ['exportDefault' as const]),
      ),
    }),
  );

const rest = fc.record({
  names: keys,
  kind: fc.constantFrom<Kind>('object', 'map', 'set', 'array', 'in'),
  placement: fc.constantFrom<Placement>(
    'same',
    'importedTable',
    'importedHandlers',
    'namedHandler',
  ),
  cast: fc.constantFrom<Cast>('none', 'any', 'record', 'parens', 'nonNull'),
  key: fc.nat(),
  decoys: fc.array(
    fc.record({
      where: fc.constantFrom('main' as const, 'other' as const),
      does: fc.constantFrom('read' as const, 'changeOther' as const, 'changeTable' as const),
      form: fc.nat(),
    }),
    { maxLength: 3 },
  ),
  shadow: fc.constantFrom<Shadow>('none', 'param', 'local', 'hoistedVar', 'siblingBlock'),
});

const cases: fc.Arbitrary<Case> = fc
  .tuple(rest, handlerAndAdded)
  .map(([others, handling]) => ({ ...others, ...handling }));

function isDispatch(kind: Kind) {
  return kind === 'object' || kind === 'map';
}

/** Entry `i`'s handler: `h<i>` when they're imported, `h` when one is named, or an arrow. */
function handlerOf(test: Case, i: number) {
  switch (test.placement) {
    case 'importedHandlers':
      return `h${i}`;
    case 'namedHandler':
      return 'h';
    default:
      return `() => ${i}`;
  }
}

/** The names the table's literal holds: all of them, or all but the last when the top level adds it. */
function literalNames(test: Case) {
  return test.added === 'literal' ? test.names : test.names.slice(0, -1);
}

/** The table's literal: handlers for dispatch, values for membership. */
function definition(test: Case) {
  const names = literalNames(test);
  switch (test.kind) {
    case 'object':
      return `{ ${names.map((name, i) => `${name}: ${handlerOf(test, i)}`).join(', ')} }`;
    case 'map':
      return `new Map([${names.map((name, i) => `['${name}', ${handlerOf(test, i)}]`).join(', ')}])`;
    case 'set':
      return `new Set([${names.map((name) => `'${name}'`).join(', ')}])`;
    case 'array':
      return `[${names.map((name) => `'${name}'`).join(', ')}]`;
    default:
      return `{ ${names.map((name) => `${name}: 1`).join(', ')} }`;
  }
}

/** The top-level statement that adds the table's last entry, if the literal doesn't hold it. */
function addition(test: Case) {
  if (test.added === 'literal') return [];
  const i = test.names.length - 1;
  const name = test.names[i];
  const add = {
    object: `T.${name} = ${handlerOf(test, i)}`,
    map: `T.set('${name}', ${handlerOf(test, i)})`,
    set: `T.add('${name}')`,
    array: `T[${i}] = '${name}'`,
    in: `T.${name} = 1`,
  }[test.kind];
  const statement = {
    statement: `${add};`,
    exportAssignment: `export = ${add};`,
    exportDefault: `export default ${add};`,
  }[test.added];
  return [statement];
}

/** The declaration of the one function every entry names, in the `namedHandler` placement. */
function namedHandler(test: Case) {
  return {
    function: 'function h() { return 0; }',
    exported: 'export function h() { return 0; }',
    defaultExported: 'export default function h() { return 0; }',
    defaultAsync: 'export default async function h() { return 0; }',
    const: 'const h = () => 0;',
  }[test.handler];
}

/** The ways a dispatch can be keyed: at run time first, then static ones; a Map's `.get()` can take none. */
const DISPATCH_KEYS = { object: ['k', "'k0'", '`k0`'], map: ['k', "'k0'", '`k0`', ''] } as const;

/** The key a dispatch reads with, by the case's choice. */
function keyOf(test: Case, kind: 'object' | 'map') {
  const forms = DISPATCH_KEYS[kind];
  return forms[test.key % forms.length];
}

/** Whether the case reads a dispatch with a key known before it runs. */
function staticRead(test: Case) {
  return (test.kind === 'object' || test.kind === 'map') && keyOf(test, test.kind) !== 'k';
}

/** The read of the table, through the case's cast, under the name `table`. */
function read(test: Case, table: string) {
  const wrapped = {
    none: table,
    any: `(${table} as any)`,
    record: `(${table} as Record<string, any>)`,
    parens: `(${table})`,
    nonNull: `${table}!`,
  }[test.cast];
  switch (test.kind) {
    case 'object':
      return `return ${wrapped}[${keyOf(test, 'object')}]();`;
    case 'map':
      return `return ${wrapped}.get(${keyOf(test, 'map')})!();`;
    case 'set':
      return `return ${wrapped}.has(k);`;
    case 'array':
      return `return ${wrapped}.includes(k);`;
    default:
      return `return k in ${wrapped};`;
  }
}

/** `run`, reading the table as `table`, with the case's local of the same name. */
function runFunction(test: Case, table: string) {
  const body = read(test, table);
  switch (test.shadow) {
    case 'param':
      return `export function run(k: string, T: any) { ${body} }`;
    case 'local':
      return `export function run(k: string) { const T: any = other; ${body} }`;
    case 'hoistedVar':
      return `export function run(k: string) { { var T: any = other; } ${body} }`;
    case 'siblingBlock':
      return `export function run(k: string) { { const T = 1; log(T); } ${body} }`;
    default:
      return `export function run(k: string) { ${body} }`;
  }
}

/** The ways a decoy can be written, for what it does. */
function decoyForms(does: Decoy['does']) {
  switch (does) {
    case 'read':
      return READS_OF_TABLE;
    case 'changeTable':
      return CHANGES_TO_TABLE;
    default:
      return CHANGES_TO_OTHER;
  }
}

/** A decoy function's body. */
function decoyBody(decoy: Decoy) {
  const forms = decoyForms(decoy.does);
  return forms[decoy.form % forms.length];
}

/** The two modules: the file scored, `main`, and `./other.ts`, if the case imports from it. */
function modules(test: Case, table: string) {
  const handlers = test.names.map((_, i) => `export function h${i}() { return ${i}; }`);
  function decoys(where: Decoy['where']) {
    return test.decoys
      .map((decoy, i) => ({ decoy, i }))
      .filter(({ decoy }) => (test.placement === 'same' ? 'main' : decoy.where) === where)
      .map(({ decoy, i }) => `function d${i}(x: any) { ${decoyBody(decoy)} }`);
  }
  const other: string[] = [];
  const main: string[] = [];
  if (test.placement === 'importedTable') {
    other.push(`export const T = ${definition(test)};`, ...addition(test));
    main.push("import { T } from './other.ts';");
  } else if (test.placement === 'importedHandlers' && isDispatch(test.kind)) {
    other.push(...handlers);
    main.push(`import { ${test.names.map((_, i) => `h${i}`).join(', ')} } from './other.ts';`);
    main.push(`const T = ${definition(test)};`, ...addition(test));
  } else if (test.placement === 'namedHandler' && isDispatch(test.kind)) {
    main.push(namedHandler(test), `const T = ${definition(test)};`, ...addition(test));
  } else {
    const same = { ...test, placement: 'same' as const };
    main.push(`const T = ${definition(same)};`, ...addition(same));
  }
  other.push(...decoys('other'));
  main.push(...decoys('main'), runFunction(test, table));
  return { main: main.join('\n'), other: other.join('\n') };
}

/** `run`'s complexity in a case's main module, with `./other.ts` as the case writes it. */
function score(test: Case, table: string, counting: Counting) {
  const { main, other } = modules(test, table);
  function imported(from: string): ReturnType<Imported> {
    return from === './other.ts' ? moduleExports('other.ts', other) : undefined;
  }
  return parse('main.ts', main, counting, imported).functions.find((fn) => fn.label === 'run')
    ?.complexity;
}

/** Whether a decoy changes the table itself: in this file, or in the module that defines it. */
function changesTable(test: Case) {
  return test.decoys.some(
    (decoy) =>
      decoy.does === 'changeTable' &&
      (test.placement === 'same' || decoy.where === 'main' || test.placement === 'importedTable'),
  );
}

function switchVersion(names: readonly string[]) {
  const cases = names.map((name, i) => `    case '${name}': return h${i}();`).join('\n');
  return `export function run(k: string) {\n  switch (k) {\n${cases}\n  }\n  return -1;\n}`;
}

function chainVersion(names: readonly string[]) {
  return `export function run(k: string) { return ${names.map((name) => `k === '${name}'`).join(' || ')}; }`;
}

/** What `run` must score: as the code with no table, or as a read of no table at all. */
function expected(test: Case, counting: Counting) {
  const hidden = test.shadow === 'param' || test.shadow === 'local' || test.shadow === 'hoistedVar';
  if (changesTable(test) || hidden || staticRead(test)) return score(test, 'Nope', counting);
  const plain = isDispatch(test.kind) ? switchVersion(test.names) : chainVersion(test.names);
  return parse('plain.ts', plain, counting).functions.find((fn) => fn.label === 'run')?.complexity;
}

describe('a lookup table scores as the code it replaces', () => {
  it('wherever it lives, however it’s read, and whatever else the code does with it', () => {
    fc.assert(
      fc.property(cases, countings, (test, counting) => {
        expect(score(test, 'T', counting)).toBe(expected(test, counting));
      }),
      { numRuns: 500 },
    );
  });
});
