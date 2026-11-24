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

/** A piece of code, and how many classes and `this`es in it each rule must report. */
type Code = { readonly code: string; readonly classes: number; readonly thises: number };

/**
 * The parts one after another. Each part's names end in `ID`, which becomes its place in the list,
 * so two copies of the same part don't declare the same name twice.
 */
function join(parts: readonly Code[]): Code {
  return {
    code: parts.map((part, i) => part.code.replaceAll('ID', `_${i}`)).join('\n'),
    classes: parts.reduce((sum, part) => sum + part.classes, 0),
    thises: parts.reduce((sum, part) => sum + part.thises, 0),
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

/** A statement that reads `this`, or one that looks like it does and doesn't. */
const statement = fc.constantFrom<Code>(
  { code: 'this;', classes: 0, thises: 1 },
  { code: 'use(this.value);', classes: 0, thises: 1 },
  { code: 'const readID = () => this;', classes: 0, thises: 1 },
  { code: 'function nestedID() { return this.x + this.y; }', classes: 0, thises: 2 },
  { code: 'self.value;', classes: 0, thises: 0 },
  { code: 'globalThis;', classes: 0, thises: 0 },
  { code: "const saidID = 'this';", classes: 0, thises: 0 },
  { code: 'thisValue;', classes: 0, thises: 0 },
  { code: '// this.value', classes: 0, thises: 0 },
);
const body = fc.array(statement, { maxLength: 3 }).map(join);

/** A class, in one of the places a class can be written, with a method holding `body`. */
const classCode = fc
  .tuple(name, heritage, body, fc.constantFrom('declaration', 'export', 'expression', 'argument'))
  .map(([n, { clause, error }, inner, place]): Code => {
    const members = `{\n  method() {\n${inner.code}\n  }\n}`;
    const classes = error ? 0 : 1;
    switch (place) {
      case 'declaration':
        return { code: `class ${n}ID${clause} ${members}`, classes, thises: inner.thises };
      case 'export':
        return { code: `export class ${n}ID${clause} ${members}`, classes, thises: inner.thises };
      case 'expression':
        return { code: `const ${n}ID = class${clause} ${members};`, classes, thises: inner.thises };
      default:
        return { code: `use(class${clause} ${members});`, classes, thises: inner.thises };
    }
  });

/** Top-level code that's neither a class nor `this`, though it looks like one. */
const lookAlike = fc.constantFrom<Code>(
  { code: 'function typedID(this: Window) {}', classes: 0, thises: 0 },
  { code: 'interface ChainID { next(): this }', classes: 0, thises: 0 },
  { code: "const klassID = { className: 'row' };", classes: 0, thises: 0 },
  { code: 'function StoreID() { return {}; }', classes: 0, thises: 0 },
);

/** A function holding `body`, so `this` is read outside any class too. */
const functionCode = body.map((inner) => ({
  ...inner,
  code: `function fID() {\n${inner.code}\n}`,
}));

const program = fc
  .array(fc.oneof(classCode, lookAlike, functionCode, statement), { minLength: 1, maxLength: 4 })
  .map(join);

/** Checks that `rule` reports `count` problems in `code`. */
function reports(
  ruleName: string,
  rule: typeof noClasses | typeof noThis,
  code: string,
  count: number,
) {
  if (count === 0) tester.run(ruleName, rule, { valid: [code], invalid: [] });
  else tester.run(ruleName, rule, { valid: [], invalid: [{ code, errors: count }] });
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
});
