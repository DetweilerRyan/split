import fc from 'fast-check';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';
import { noClasses, noThis } from './functional.ts';

// Random programs from a small grammar that knows what it writes: how many classes the rule must
// report, and how many `this`es. The forms vary where a class or `this` lives and what it extends,
// with look-alikes that must never be reported. The code is only parsed, never run.

// RuleTester reports through the test runner it's given. Run its cases in place, so a failing
// case throws inside the property and fast-check can shrink it.
function inPlace(_text: string, fn: () => void) {
  fn();
}
RuleTester.describe = inPlace;
RuleTester.it = inPlace;
const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } });

/**
 * A piece of code, and how many classes and `this`es in it each rule must report: `thises` by
 * default, and `outside` with `no-this`'s allowInClasses option, which allows a `this` that reads
 * its class. `free` counts the `this`es that bind to the scope the code is put in, rather than to a
 * function of its own.
 */
type Code = {
  readonly code: string;
  readonly classes: number;
  readonly thises: number;
  readonly free: number;
  readonly outside: number;
};

/**
 * The parts one after another. Each part's names end in `ID`, which becomes its place in the list,
 * so two copies of the same part don't declare the same name twice.
 */
function join(parts: readonly Code[]): Code {
  return {
    code: parts.map((part, i) => part.code.replaceAll('ID', `_${i}`)).join('\n'),
    classes: parts.reduce((sum, part) => sum + part.classes, 0),
    thises: parts.reduce((sum, part) => sum + part.thises, 0),
    free: parts.reduce((sum, part) => sum + part.free, 0),
    outside: parts.reduce((sum, part) => sum + part.outside, 0),
  };
}

const name = fc.constantFrom('Store', 'Run', 'Actor', 'Cache');

/** What a class extends, and whether that makes it an Error subclass. */
const heritage = fc.oneof(
  fc.constant({ clause: '', error: false }),
  fc.constant({ clause: ' extends Error', error: true }),
  name.map((n) => ({ clause: ` extends ${n}Error`, error: true })),
  name.map((n) => ({ clause: ` extends errors.${n}Error`, error: true })),
  // Look-alikes of an Error subclass, which are still classes the rule reports.
  name.map((n) => ({ clause: ` extends ${n}`, error: false })),
  fc.constant({ clause: ' extends Errors', error: false }),
  fc.constant({ clause: ' extends ErrorLike', error: false }),
  fc.constant({ clause: " extends errors['Error']", error: false }),
  name.map((n) => ({ clause: ` extends errors[${n}Error]`, error: false })),
  fc.constant({ clause: ' extends mixin(Error)', error: false }),
);

/**
 * A statement that reads `this`, or one that looks like it does and doesn't. Outside a class, every
 * `this` in it is reported, with allowInClasses or without.
 */
const statement = fc
  .constantFrom<Omit<Code, 'outside'>>(
    { code: 'this;', classes: 0, thises: 1, free: 1 },
    { code: 'use(this.value);', classes: 0, thises: 1, free: 1 },
    // An arrow function binds no `this` of its own, and a `function` does.
    { code: 'const readID = () => this;', classes: 0, thises: 1, free: 1 },
    { code: 'function nestedID() { return this.x + this.y; }', classes: 0, thises: 2, free: 0 },
    { code: 'const boundID = function () { return this; };', classes: 0, thises: 1, free: 0 },
    { code: 'self.value;', classes: 0, thises: 0, free: 0 },
    { code: 'globalThis;', classes: 0, thises: 0, free: 0 },
    { code: "const saidID = 'this';", classes: 0, thises: 0, free: 0 },
    { code: 'thisValue;', classes: 0, thises: 0, free: 0 },
    { code: '// this.value', classes: 0, thises: 0, free: 0 },
    // `typeof this` only names a type, so it reads nothing at run time.
    { code: 'let typedID: typeof this;', classes: 0, thises: 0, free: 0 },
    { code: 'let fieldID: typeof this.value;', classes: 0, thises: 0, free: 0 },
  )
  .map((part) => ({ ...part, outside: part.thises }));
const body = fc.array(statement, { maxLength: 3 }).map(join);

/** The member of a class that holds a body. */
const member = fc.constantFrom('method', 'field', 'static block', 'constructor', 'getter');

/** A class's members, with `inner` in the member `held`. A derived class calls `super()` first. */
function membersOf(held: string, inner: string, derived: boolean): string {
  switch (held) {
    case 'method':
      return `{\n  method() {\n${inner}\n  }\n}`;
    case 'field':
      return `{\n  value = () => {\n${inner}\n  };\n}`;
    case 'static block':
      return `{\n  static {\n${inner}\n  }\n}`;
    case 'constructor':
      return `{\n  constructor() {\n${derived ? 'super();\n' : ''}${inner}\n  }\n}`;
    default:
      return `{\n  get value() {\n${inner}\n    return 1;\n  }\n}`;
  }
}

/** A class with `members`, written in `place`. Each member binds `this` to its class. */
function classIn(place: string, n: string, clause: string, members: string): string {
  switch (place) {
    case 'declaration':
      return `class ${n}ID${clause} ${members}`;
    case 'export':
      return `export class ${n}ID${clause} ${members}`;
    case 'export default':
      return `export default class${clause} ${members}`;
    case 'expression':
      return `const ${n}ID = class${clause} ${members};`;
    case 'argument':
      return `use(class${clause} ${members});`;
    case 'namespace':
      return `namespace SpaceID {\n  class ${n}${clause} ${members}\n}`;
    case 'function':
      return `function holdID() {\n  class ${n}${clause} ${members}\n}`;
    default:
      // Nested in another class, which is reported too.
      return `class OuterID {\n  static Inner = class${clause} ${members};\n}`;
  }
}

/** A class written in one of `places`, with a member holding a generated body. */
function classAt(places: fc.Arbitrary<string>): fc.Arbitrary<Code> {
  return fc
    .tuple(places, name, heritage, body, member)
    .map(([place, n, { clause, error }, inner, held]) => ({
      code: classIn(place, n, clause, membersOf(held, inner.code, clause !== '')),
      classes: (error ? 0 : 1) + (place === 'nested' ? 1 : 0),
      thises: inner.thises,
      free: 0,
      // The member's own `this`es read the class, and those under a `function` in it don't.
      outside: inner.thises - inner.free,
    }));
}

const placedClass = classAt(
  fc.constantFrom(
    'declaration',
    'export',
    'expression',
    'argument',
    'namespace',
    'function',
    'nested',
  ),
);
/** A module may have only one `export default`, so a program has at most one of these. */
const defaultClass = classAt(fc.constant('export default'));

/** Top-level code that's neither a class nor `this`, though it looks like one. */
const lookAlike = fc
  .constantFrom(
    'function typedID(this: Window) {}',
    'interface ChainID { next(): this }',
    'type SelfID = { m(): typeof this };',
    'function pickID(this: A, y: typeof this.x) {}',
    "const klassID = { className: 'row' };",
    'function StoreID() { return {}; }',
  )
  .map((code): Code => ({ code, classes: 0, thises: 0, free: 0, outside: 0 }));

/** A function holding `body`, so `this` is read outside any class too. */
const functionCode = body.map((inner) => ({
  ...inner,
  code: `function fID() {\n${inner.code}\n}`,
  free: 0,
  outside: inner.thises,
}));

const program = fc
  .tuple(
    fc.array(fc.oneof(placedClass, lookAlike, functionCode, statement), {
      minLength: 1,
      maxLength: 4,
    }),
    fc.option(defaultClass, { nil: undefined }),
  )
  .map(([parts, last]) => join(last ? [...parts, last] : parts));

/** A case RuleTester runs, written as an object rather than as code alone. */
type Case = Exclude<Parameters<RuleTester['run']>[2]['valid'][number], string>;

/** Checks that `rule`, given `options`, reports `count` problems in `code`. */
function reports(
  ruleName: string,
  rule: typeof noClasses | typeof noThis,
  code: string,
  count: number,
  options?: Case['options'],
) {
  // A rule with no options refuses even an empty list, so `no-classes` is given none at all.
  const test: Case = options ? { code, options } : { code };
  if (count === 0) tester.run(ruleName, rule, { valid: [test], invalid: [] });
  else tester.run(ruleName, rule, { valid: [], invalid: [{ ...test, errors: count }] });
}

describe('the functional plugin, on generated programs', () => {
  it('reports every class but an Error subclass, and every `this`, and nothing else', () => {
    fc.assert(
      fc.property(program, ({ code, classes, thises }) => {
        reports('no-classes', noClasses, code, classes);
        reports('no-this', noThis, code, thises);
      }),
    );
  });

  it('with allowInClasses, reports every `this` that does not read its class', () => {
    fc.assert(
      fc.property(program, ({ code, outside }) => {
        reports('no-this', noThis, code, outside, [{ allowInClasses: true }]);
      }),
    );
  });
});
