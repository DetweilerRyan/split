import { RuleTester } from 'oxlint/plugins-dev';
import { describe, expect, it } from 'vitest';
import plugin, {
  asserted,
  exampleOrigin,
  noFilter,
  noLeftovers,
  noRandom,
  noTry,
  predicate,
} from './property.ts';

// oxlint's RuleTester parses each case with oxlint's own parser, in this process, and runs the
// rule's visitors on it. It reports through the test runner it's given.
RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } });

/** A test file's code, with fast-check imported as `fc`. */
function file(body: string): string {
  return `import fc from 'fast-check';\n${body}`;
}

describe('the property plugin', () => {
  it('is named property, so its rules are property/<rule>', () => {
    expect(plugin.meta.name).toBe('property');
    expect(plugin.rules).toEqual({
      asserted,
      'no-leftovers': noLeftovers,
      'no-filter': noFilter,
      predicate,
      'no-try': noTry,
      'no-random': noRandom,
      'example-origin': exampleOrigin,
    });
  });
});

tester.run('asserted', asserted, {
  valid: [
    file('fc.assert(fc.property(fc.integer(), (n) => { expect(n).toBe(n); }));'),
    file('await fc.assert(fc.asyncProperty(fc.integer(), async () => { f(); }));'),
    file('fc.check(fc.property(fc.integer(), () => { f(); }));'),
    // Through a variable that is run.
    file('const p = fc.property(fc.integer(), () => { f(); });\nfc.assert(p, { numRuns: 10 });'),
    // fast-check under another name, or as a namespace.
    `import check from 'fast-check';\ncheck.assert(check.property(check.integer(), () => { f(); }));`,
    `import * as fc from 'fast-check';\nfc.assert(fc.property(fc.integer(), () => { f(); }));`,
    // Something else called property.
    'const fc = { property() {} };\nfc.property(1, 2);',
    `import { property } from 'other';\nproperty(1, () => {});`,
  ],
  invalid: [
    {
      code: file('fc.property(fc.integer(), () => { f(); });'),
      errors: [{ messageId: 'unrun' }],
    },
    {
      code: file('const p = fc.property(fc.integer(), () => { f(); });\nuse(p);'),
      errors: [{ messageId: 'unrun' }],
    },
    {
      code: file('fc.assert(other, fc.property(fc.integer(), () => { f(); }));'),
      errors: [{ messageId: 'unrun' }],
    },
    {
      code: file('const p = fc.asyncProperty(fc.integer(), async () => { f(); });'),
      errors: [{ messageId: 'unrun' }],
    },
  ],
});

tester.run('no-leftovers', noLeftovers, {
  valid: [
    file('fc.assert(p);'),
    file('fc.assert(p, { numRuns: 300, examples: [[1]], verbose: true });'),
    file('fc.assert(p, { plugins: [fc.timeout(1000)] });'),
    // A run's own settings, outside fast-check.
    'other.assert(p, { seed: 1 });',
    file('f({ seed: 1, numRuns: Infinity });'),
    // Settings passed by name aren't read.
    file('fc.assert(p, settings);'),
  ],
  invalid: [
    { code: file('fc.assert(p, { seed: 42 });'), errors: [{ messageId: 'replay' }] },
    { code: file("fc.check(p, { path: '3:1' });"), errors: [{ messageId: 'replay' }] },
    { code: file("fc.assert(p, { 'seed': 1 });"), errors: [{ messageId: 'replay' }] },
    {
      code: file('fc.assert(p, { numRuns: Number.POSITIVE_INFINITY });'),
      errors: [{ messageId: 'soak' }],
    },
    { code: file('fc.assert(p, { numRuns: Infinity });'), errors: [{ messageId: 'soak' }] },
    {
      code: file('fc.assert(p, { interruptAfterTimeLimit: 1000, markInterruptAsFailure: false });'),
      errors: [{ messageId: 'soak' }, { messageId: 'soak' }],
    },
    {
      code: file(
        'fc.assert(p, { plugins: [fc.timeout(1), fc.interruptAfterTimeLimit(120_000)] });',
      ),
      errors: [{ messageId: 'soak' }],
    },
  ],
});

tester.run('no-filter', noFilter, {
  valid: [
    file('const xs = items.filter((x) => x.ok);'),
    file('const a = fc.integer({ min: 1 });'),
    file('const a = fc.array(fc.integer()).map((xs) => xs.filter((x) => x > 0));'),
    // fast-check isn't imported, so `fc` is something else.
    'fc.pre(x);\nfc.integer().filter(f);',
  ],
  invalid: [
    { code: file('fc.pre(n > 0);'), errors: [{ messageId: 'pre' }] },
    {
      code: file('const a = fc.integer().filter((n) => n > 0);'),
      errors: [{ messageId: 'filter' }],
    },
    {
      code: file(
        'const a = fc\n  .tuple(fc.integer(), fc.string())\n  .map(([n, s]) => s + n)\n  .filter(f);',
      ),
      errors: [{ messageId: 'filter' }],
    },
  ],
});

tester.run('predicate', predicate, {
  valid: [
    file('fc.assert(fc.property(fc.integer(), (n) => { expect(n).toBe(n); }));'),
    file('fc.assert(fc.property(fc.integer(), (n) => expect(n).toBe(n)));'),
    // A helper that asserts.
    file('fc.assert(fc.property(fc.integer(), (n) => { reports(n); }));'),
    file('fc.assert(fc.property(fc.integer(), (n) => { if (n < 0) throw new Error("x"); }));'),
    // A return inside a nested function belongs to that function.
    file(
      'fc.assert(fc.property(fc.array(fc.integer()), (xs) => { check(xs.map((x) => { return x; })); }));',
    ),
    file('fc.assert(fc.property(fc.integer(), (n) => { if (n) return; check(n); }));'),
    // A function that isn't a property's predicate.
    file('const f = () => true;\nfc.assert(fc.property(fc.integer(), f));'),
  ],
  invalid: [
    {
      code: file('fc.assert(fc.property(fc.integer(), (n) => n > 0));'),
      errors: [{ messageId: 'returns' }],
    },
    {
      code: file('fc.assert(fc.property(fc.integer(), (n) => { check(n); return true; }));'),
      errors: [{ messageId: 'returns' }],
    },
    {
      code: file('fc.assert(fc.property(fc.integer(), function (n) { check(n); return n > 0; }));'),
      errors: [{ messageId: 'returns' }],
    },
    {
      code: file('fc.assert(fc.property(fc.integer(), () => {}));'),
      errors: [{ messageId: 'empty' }],
    },
    {
      code: file('fc.assert(fc.property(fc.integer(), (n) => { const m = n + 1; }));'),
      errors: [{ messageId: 'empty' }],
    },
  ],
});

tester.run('no-try', noTry, {
  valid: [
    file('fc.assert(fc.property(fc.integer(), (n) => { expect(() => f(n)).toThrow(); }));'),
    file('fc.assert(fc.property(fc.integer(), (n) => { try { f(n); } finally { g(); } }));'),
    // A try outside a predicate.
    file(
      'try { setup(); } catch { skip(); }\nfc.assert(fc.property(fc.integer(), (n) => { f(n); }));',
    ),
    // Code that only reads as a try, in a string.
    file("fc.assert(fc.property(fc.integer(), () => { parse('try { a } catch { b }'); }));"),
  ],
  invalid: [
    {
      code: file('fc.assert(fc.property(fc.integer(), (n) => { try { f(n); } catch { } }));'),
      errors: [{ messageId: 'try' }],
    },
    {
      code: file(
        'fc.assert(fc.property(fc.integer(), (n) => { [n].forEach((m) => { try { f(m); } catch (e) { log(e); } }); }));',
      ),
      errors: [{ messageId: 'try' }],
    },
  ],
});

tester.run('no-random', noRandom, {
  valid: [
    file('const a = fc.integer();'),
    'const xs = sample(fc);\nrandom();',
    'const r = Random.random();',
  ],
  invalid: [
    {
      code: file('fc.assert(fc.property(fc.integer(), (n) => { f(n + Math.random()); }));'),
      errors: [{ messageId: 'random' }],
    },
    { code: file('const seedless = Math.random();'), errors: [{ messageId: 'random' }] },
    { code: file('const xs = fc.sample(fc.integer(), 10);'), errors: [{ messageId: 'sample' }] },
  ],
});

tester.run('example-origin', exampleOrigin, {
  valid: [
    file('fc.assert(p, { examples: [\n  // Found by a soak run on #155.\n  [1],\n] });'),
    file(
      'fc.assert(p, { examples: [\n  /* Found by CI on #155. */ [1],\n  // Found by a local run on #155.\n  [2],\n] });',
    ),
    file('fc.assert(p, { numRuns: 10 });'),
    file('const examples = [[1]];'),
  ],
  invalid: [
    { code: file('fc.assert(p, { examples: [[1]] });'), errors: [{ messageId: 'origin' }] },
    {
      code: file(
        'fc.assert(p, { examples: [\n  // Found by a soak run on #155.\n  [1],\n  // a second one\n  [2],\n] });',
      ),
      errors: [{ messageId: 'origin' }],
    },
  ],
});
