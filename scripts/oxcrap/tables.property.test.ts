import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type Counting } from './complexity.ts';
import { parse } from './functions.ts';

// A switch moved into a table, or an `||` chain moved into a Set, must score as it did: that's the
// move tables.ts exists to see through.

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
const keys = fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/), {
  minLength: 1,
  maxLength: 8,
});

/** The complexity of `run`, the function each version exports. */
function run(code: string, counting: Counting) {
  return parse('example.ts', code, counting).functions.find((fn) => fn.label === 'run')?.complexity;
}

function switchVersion(names: string[]) {
  const helpers = names.map((name, i) => `function h${i}() { return ${i}; }`).join('\n');
  const cases = names.map((name, i) => `    case '${name}': return h${i}();`).join('\n');
  return `${helpers}\nexport function run(k: string) {\n  switch (k) {\n${cases}\n  }\n  return -1;\n}`;
}

const dispatchVersions = {
  object(names: string[]) {
    const entries = names.map((name, i) => `${name}: () => ${i}`).join(', ');
    return `const T = { ${entries} };\nexport function run(k: string) { return T[k](); }`;
  },
  map(names: string[]) {
    const entries = names.map((name, i) => `['${name}', () => ${i}]`).join(', ');
    return `const T = new Map([${entries}]);\nexport function run(k: string) { return T.get(k)!(); }`;
  },
};

function chainVersion(names: string[]) {
  return `export function run(k: string) { return ${names.map((name) => `k === '${name}'`).join(' || ')}; }`;
}

const membershipVersions = {
  set: (names: string[]) =>
    `const S = new Set([${names.map((n) => `'${n}'`).join(', ')}]);\nexport function run(k: string) { return S.has(k); }`,
  array: (names: string[]) =>
    `const A = [${names.map((n) => `'${n}'`).join(', ')}];\nexport function run(k: string) { return A.includes(k); }`,
  object: (names: string[]) =>
    `const O = { ${names.map((n) => `${n}: 1`).join(', ')} };\nexport function run(k: string) { return k in O; }`,
};

describe('a lookup table scores as the code it replaces', () => {
  it.each(Object.entries(dispatchVersions))('a switch moved into a dispatch %s', (_, version) => {
    fc.assert(
      fc.property(keys, countings, (names, counting) => {
        expect(run(version(names), counting)).toBe(run(switchVersion(names), counting));
      }),
    );
  });

  it.each(Object.entries(membershipVersions))(
    'an || chain moved into a membership test on a %s',
    (_, version) => {
      fc.assert(
        fc.property(keys, countings, (names, counting) => {
          expect(run(version(names), counting)).toBe(run(chainVersion(names), counting));
        }),
      );
    },
  );
});
