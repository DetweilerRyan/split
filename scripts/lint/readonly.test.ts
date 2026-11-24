import { RuleTester } from 'oxlint/plugins-dev';
import { describe, expect, it } from 'vitest';
import plugin, { types } from './readonly.ts';

// oxlint's RuleTester parses each case with oxlint's own parser, in this process, and runs the
// rule's visitors on it. It reports through the test runner it's given.
RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } });

describe('the readonly plugin', () => {
  it('is named readonly, so its rule is readonly/types', () => {
    expect(plugin.meta.name).toBe('readonly');
    expect(plugin.rules).toEqual({ types });
  });
});

tester.run('types', types, {
  valid: [
    // Each kind of type, readonly.
    'type T = readonly string[];',
    'type T = readonly (string | number)[];',
    'type T = readonly [number, string];',
    'type T = readonly [first: number, ...rest: readonly string[]];',
    'type T = ReadonlyArray<string>;',
    'type T = ReadonlyMap<string, number>;',
    'type T = ReadonlySet<string>;',
    'type T = Readonly<Record<string, number>>;',
    'type T = { readonly a: number; readonly b?: string };',
    'interface I { readonly a: number; readonly [key: string]: number }',
    'type T = { readonly [key: string]: number };',
    'type T = { readonly [K in Keys]: number };',
    'type T = { +readonly [K in Keys]: number };',
    // Readonly<…> makes its object type's members, arrays and records readonly.
    'type T = Readonly<{ a: number; [key: string]: number }>;',
    'type T = Readonly<string[]>;',
    'type T = Readonly<[number, string]>;',
    'type T = Readonly<Array<string>>;',
    'type T = Readonly<{ [K in Keys]: number }>;',
    'type T = Readonly<{ a: number } | { b: string }>;',
    'type T = Readonly<{ a: number } & ({ b: string })>;',
    // Methods, call signatures and types with no members to mark.
    'interface I { m(): void; (x: number): string; new (): I }',
    'type T = string;',
    'type T = Items[number];',
    'type T = keyof Items;',
    // A variable declared inside a function may be a working value.
    'function f() { const out: string[] = []; out.push("a"); return out; }',
    'const f = () => { let seen: Set<string> = new Set(); return seen; };',
    'const f = function () { const m: Map<string, { n: number }> = new Map(); return m; };',
    'function f() { const [a]: [number] = [1]; const { b }: { b: number[] } = { b: [] }; }',
    'function f() { const g: (xs: { a: string[] }) => Record<string, number> = h; }',
    'function f() { const g: ({ a }: { a: string[] }, [b]: [number], ...c: number[]) => void = h; }',
    // Names that only look like the mutable kinds.
    'type T = MyArray<string>;',
    'type T = Records.Record<string, number>;',
    'type T = ArrayLike<string>;',
    'type T = WeakMap<object, number>;',
  ],
  invalid: [
    {
      code: 'type T = string[];',
      errors: [
        {
          message:
            'Write `readonly T[]` or `readonly [A, B]`: types are readonly by default, as the owner decided on DetweilerRyan/split#69.',
          line: 1,
          column: 9,
        },
      ],
    },
    { code: 'type T = [number, string];', errors: [{ messageId: 'list' }] },
    { code: 'type T = Array<string>;', errors: [{ messageId: 'array' }] },
    { code: 'type T = Map<string, number>;', errors: [{ messageId: 'map' }] },
    { code: 'type T = Set<string>;', errors: [{ messageId: 'set' }] },
    { code: 'type T = Record<string, number>;', errors: [{ messageId: 'record' }] },
    { code: 'type T = { a: number };', errors: [{ messageId: 'property' }] },
    { code: 'interface I { a?: number }', errors: [{ messageId: 'property' }] },
    { code: 'interface I { [key: string]: number }', errors: [{ messageId: 'index' }] },
    { code: 'type T = { [K in Keys]: number };', errors: [{ messageId: 'mapped' }] },
    { code: 'type T = { -readonly [K in Keys]: number };', errors: [{ messageId: 'mapped' }] },
    // Level by level: each nested type is checked on its own.
    {
      code: 'type T = readonly string[][];',
      errors: [{ messageId: 'list', column: 18 }],
    },
    {
      code: 'type T = Readonly<{ a: { b: number }; c: string[] }>;',
      errors: [{ messageId: 'property' }, { messageId: 'list' }],
    },
    { code: 'type T = Readonly<Map<string, number>>;', errors: [{ messageId: 'map' }] },
    { code: 'type T = Readonly<Set<string>>;', errors: [{ messageId: 'set' }] },
    { code: 'type T = ReadonlyArray<string[]>;', errors: [{ messageId: 'list' }] },
    { code: 'type T = readonly Record<string, number>[];', errors: [{ messageId: 'record' }] },
    { code: 'type T = Partial<{ a: number }>;', errors: [{ messageId: 'property' }] },
    { code: 'type T = Readonly<Promise<{ a: number }>>;', errors: [{ messageId: 'property' }] },
    { code: 'type T = keyof string[];', errors: [{ messageId: 'list' }] },
    {
      code: 'function f() { const k = (): string[] => []; }',
      errors: [{ messageId: 'list' }],
    },
    // Every place a type is written, outside a local variable's annotation.
    { code: 'function f(xs: string[]) {}', errors: [{ messageId: 'list' }] },
    { code: 'function f(): Set<string> { return s; }', errors: [{ messageId: 'set' }] },
    { code: 'const xs: string[] = [];', errors: [{ messageId: 'list' }] },
    { code: 'export let m: Map<string, number>;', errors: [{ messageId: 'map' }] },
    { code: 'function f() { type T = { a: number }; }', errors: [{ messageId: 'property' }] },
    { code: 'function f() { return [] as string[]; }', errors: [{ messageId: 'list' }] },
    { code: 'function f() { return g<string[]>(); }', errors: [{ messageId: 'list' }] },
    { code: 'function f() { const g = (xs: string[]) => xs; }', errors: [{ messageId: 'list' }] },
    {
      code: 'function f() { const g = (xs: string[]): number[] => []; }',
      errors: [{ messageId: 'list' }, { messageId: 'list' }],
    },
    { code: 'function f<T extends unknown[]>() {}', errors: [{ messageId: 'list' }] },
    {
      code: 'declare global { interface Window { a: number } }',
      errors: [{ messageId: 'property' }],
    },
  ],
});
