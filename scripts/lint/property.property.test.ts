import fc from 'fast-check';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';
import plugin from './property.ts';

// Random property-test files from a small grammar that knows what it writes: for each piece, which
// rule must report it, with which message, and where. A file binds fast-check under one of the
// names the plugin follows, or doesn't import it, when only `Math.random` may be reported. Each
// property is run in place, through a variable, or never; given parameters a soak or replay left
// behind, or not; built from an arbitrary that's filtered, or a look-alike `.filter` on an array;
// and given a predicate from the forms each rule decides, look-alikes included. The code is only
// parsed, never run.

// RuleTester reports through the test runner it's given. Run its cases in place, so a failing
// case throws inside the property and fast-check can shrink it.
function inPlace(_text: string, fn: () => void) {
  fn();
}
RuleTester.describe = inPlace;
RuleTester.it = inPlace;
const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } });

type RuleName = keyof typeof plugin.rules;

/** A report the plugin must make: the rule, its message, and where in the code it starts. */
type Expected = { readonly rule: RuleName; readonly messageId: string; readonly at: number };

/** Code, and the reports it must cause, at offsets within it. */
type Piece = { readonly code: string; readonly reports: readonly Expected[] };

/** A piece of plain code that causes no report. */
function plain(code: string): Piece {
  return { code, reports: [] };
}

/** A piece whose start the rule must report. */
function reported(code: string, rule: RuleName, messageId: string): Piece {
  return { code, reports: [{ rule, messageId, at: 0 }] };
}

/** The pieces one after another, each report moved to where its piece lands. */
function join(...pieces: readonly Piece[]): Piece {
  let code = '';
  const reports: Expected[] = [];
  for (const piece of pieces) {
    reports.push(...piece.reports.map((r) => ({ ...r, at: r.at + code.length })));
    code += piece.code;
  }
  return { code, reports };
}

/** How a file binds fast-check: the name it's called by, and whether the plugin can see it. */
type Binding = { readonly line: string; readonly name: string; readonly bound: boolean };

const binding = fc.constantFrom<Binding>(
  { line: "import fc from 'fast-check';\n", name: 'fc', bound: true },
  { line: "import check from 'fast-check';\n", name: 'check', bound: true },
  { line: "import * as fc from 'fast-check';\n", name: 'fc', bound: true },
  { line: 'const fc = makeFakeFc();\n', name: 'fc', bound: false },
);

/** An arbitrary for the property: plain, filtered, or with an array's `.filter` inside a map. */
function arbitraryOf(kind: number, n: string): Piece {
  switch (kind) {
    case 0:
      return plain(`${n}.integer()`);
    case 1:
      return join(
        plain(`${n}.integer().`),
        reported('filter', 'no-filter', 'filter'),
        plain('((x) => x > 0)'),
      );
    case 2:
      return plain(`${n}.array(${n}.integer()).map((xs) => xs.filter((x) => x > 0))`);
    default:
      return join(
        plain(`${n}\n  .tuple(${n}.integer(), ${n}.string())\n  .map(([a, b]) => b + a)\n  .`),
        reported('filter', 'no-filter', 'filter'),
        plain('((s) => s !== "")'),
      );
  }
}

/** A predicate, from the forms the predicate, no-try, no-random and no-filter rules decide. */
function predicateOf(kind: number, n: string): Piece {
  switch (kind) {
    case 0:
      return plain('(v) => { expect(v).toBe(v); }');
    case 1:
      return plain('(v) => { check(v); }');
    case 2:
      return plain("(v) => { if (!v) throw new Error('x'); }");
    case 3:
      return reported('(v) => {}', 'predicate', 'empty');
    case 4:
      return join(
        plain('(v) => { check(v); '),
        reported('return true;', 'predicate', 'returns'),
        plain(' }'),
      );
    case 5:
      return join(plain('(v) => '), reported('v > 0', 'predicate', 'returns'));
    case 6:
      return plain('(v) => expect(v).toBe(v)');
    case 7:
      return join(
        plain('(v) => { '),
        reported('try { check(v); } catch { }', 'no-try', 'try'),
        plain(' }'),
      );
    case 8:
      return plain('(v) => { try { check(v); } finally { done(); } }');
    case 9:
      return join(
        plain('(v) => { check(v + '),
        reported('Math.random()', 'no-random', 'random'),
        plain('); }'),
      );
    case 10:
      return join(
        plain('(v) => { '),
        reported(`${n}.pre(v > 0)`, 'no-filter', 'pre'),
        plain('; check(v); }'),
      );
    default:
      return plain("(v) => { check(v.map((x) => { return x; }), 'try { a } catch { b }'); }");
  }
}

/** The parameters of a run: none, or the ones chosen, each reported if a soak or replay left it. */
function parametersOf(choice: readonly number[], n: string): Piece {
  const entries: Piece[] = [];
  const [runs, seed, path, plugins, examples] = choice;
  if (runs === 1) entries.push(plain('numRuns: 50'));
  if (runs === 2)
    entries.push(reported('numRuns: Number.POSITIVE_INFINITY', 'no-leftovers', 'soak'));
  if (seed === 1) entries.push(reported('seed: 7', 'no-leftovers', 'replay'));
  if (path === 1) entries.push(reported("path: '1:2'", 'no-leftovers', 'replay'));
  if (plugins === 1) entries.push(plain(`plugins: [${n}.timeout(10)]`));
  if (plugins === 2)
    entries.push(reported(`plugins: [${n}.interruptAfterTimeLimit(10)]`, 'no-leftovers', 'soak'));
  if (examples === 1) entries.push(plain('examples: [\n    // Found by CI on #1.\n    [1],\n  ]'));
  if (examples === 2)
    entries.push(
      join(plain('examples: ['), reported('[1]', 'example-origin', 'origin'), plain(']')),
    );
  if (entries.length === 0) return plain('');
  const separated = entries.flatMap((entry, i) => (i === 0 ? [entry] : [plain(', '), entry]));
  return join(plain(', { '), ...separated, plain(' }'));
}

/** One property, built and run, or not, in one of the ways the asserted rule decides. */
function propertyOf(
  index: number,
  run: number,
  n: string,
  arbitrary: Piece,
  body: Piece,
  parameters: Piece,
): Piece {
  const property = join(plain(`${n}.property(`), arbitrary, plain(', '), body, plain(')'));
  const unrun: Piece = join(reported('', 'asserted', 'unrun'), property);
  switch (run) {
    case 0:
      return join(plain(`${n}.assert(`), property, parameters, plain(');\n'));
    case 1:
      return join(plain(`${n}.check(`), property, parameters, plain(');\n'));
    case 2:
      return join(
        plain(`const p${String(index)} = `),
        property,
        plain(`;\n${n}.assert(p${String(index)}`),
        parameters,
        plain(');\n'),
      );
    case 3:
      return join(
        plain(`const p${String(index)} = `),
        unrun,
        plain(`;\nuse(p${String(index)});\n`),
      );
    default:
      return join(unrun, plain(';\n'));
  }
}

const property = fc.record({
  run: fc.integer({ min: 0, max: 4 }),
  arbitrary: fc.integer({ min: 0, max: 3 }),
  body: fc.integer({ min: 0, max: 11 }),
  parameters: fc.tuple(
    fc.integer({ min: 0, max: 2 }),
    fc.integer({ min: 0, max: 1 }),
    fc.integer({ min: 0, max: 1 }),
    fc.integer({ min: 0, max: 2 }),
    fc.integer({ min: 0, max: 2 }),
  ),
});

/** A whole file: its binding of fast-check, a sample or not, and the properties. */
const program = fc
  .record({
    binding,
    sample: fc.boolean(),
    properties: fc.array(property, { minLength: 1, maxLength: 4 }),
  })
  .map(({ binding: b, sample, properties }) => {
    const n = b.name;
    const sampled = sample
      ? join(reported(`${n}.sample(${n}.integer(), 3)`, 'no-random', 'sample'), plain(';\n'))
      : plain('');
    const file = join(
      plain(b.line),
      sampled,
      ...properties.map((p, i) =>
        propertyOf(
          i,
          p.run,
          n,
          arbitraryOf(p.arbitrary, n),
          predicateOf(p.body, n),
          p.run >= 3 ? plain('') : parametersOf(p.parameters, n),
        ),
      ),
    );
    // Without fast-check bound, only Math.random, which doesn't depend on it, may be reported.
    const reports = b.bound ? file.reports : file.reports.filter((r) => r.messageId === 'random');
    return { code: file.code, reports };
  });

describe('the property plugin, on generated property tests', () => {
  it('reports exactly what each rule decides, in source order, and nothing else', () => {
    fc.assert(
      fc.property(program, ({ code, reports }) => {
        for (const [name, rule] of Object.entries(plugin.rules)) {
          const errors = reports
            .filter((r) => r.rule === name)
            .toSorted((a, b) => a.at - b.at)
            .map(({ messageId }) => ({ messageId }));
          if (errors.length === 0) tester.run(name, rule, { valid: [code], invalid: [] });
          else tester.run(name, rule, { valid: [], invalid: [{ code, errors }] });
        }
      }),
    );
  });
});
