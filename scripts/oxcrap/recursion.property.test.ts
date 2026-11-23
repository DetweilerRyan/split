import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { COUNT_ALL } from './complexity.ts';
import { parse } from './functions.ts';

// Random call graphs among a few functions, written in the forms oxCrap resolves, with decoy calls
// that must never count. The expected answer comes from a simpler version of the same question: a
// function is in a recursion cycle exactly when a plain search from it reaches it again. That
// shares nothing with the strongly-connected-components pass recursion.ts uses.

/** How the functions are written: as declarations, const arrows, or methods of one class. */
type Form = 'declaration' | 'arrow' | 'method';
/** A call in a function's body: to another function, or a decoy that must not count. */
type Call = { to: number; decoy: 'none' | 'shadowed' | 'otherObject' | 'nestedThis' };

const SIZE = 5;
function name(i: number) {
  return `f${i}`;
}

/** A call written so it reaches function `to`, or so it looks like it does but mustn't. */
function callCode(form: Form, { to, decoy }: Call) {
  const target = form === 'method' ? `this.${name(to)}` : name(to);
  switch (decoy) {
    case 'none':
      return `${target}();`;
    // A parameter of the same name hides the function.
    case 'shadowed':
      return `((${name(to)}) => ${name(to)}())(() => 0);`;
    // Another object's method of the same name isn't this one.
    case 'otherObject':
      return `other.${name(to)}();`;
    // A non-arrow function has its own `this`; with plain functions it's just a nested call.
    case 'nestedThis':
      return form === 'method' ? `(function () { return this.${name(to)}(); })();` : `void 0;`;
  }
}

function source(form: Form, bodies: Call[][]) {
  const fns = bodies.map((calls, i) => {
    const body = calls.map((call) => `  ${callCode(form, call)}`).join('\n');
    if (form === 'declaration') return `function ${name(i)}() {\n${body}\n}`;
    if (form === 'arrow') return `const ${name(i)} = () => {\n${body}\n};`;
    return `  ${name(i)}() {\n${body}\n  }`;
  });
  return form === 'method' ? `class C {\n${fns.join('\n')}\n}\n` : `${fns.join('\n')}\n`;
}

/** The functions that reach themselves, following only the real calls. */
function inCycles(bodies: Call[][]) {
  const edges = bodies.map((calls) => calls.filter((c) => c.decoy === 'none').map((c) => c.to));
  return bodies.map((_, start) => {
    const seen = new Set<number>();
    const queue = [...edges[start]];
    while (queue.length > 0) {
      const next = queue.pop() as number;
      if (next === start) return true;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(...edges[next]);
    }
    return false;
  });
}

const call = fc.record<Call>({
  to: fc.nat({ max: SIZE - 1 }),
  decoy: fc.constantFrom('none', 'none', 'shadowed', 'otherObject', 'nestedThis'),
});
const graphs = fc
  .array(fc.array(call, { maxLength: 3 }), { minLength: 1, maxLength: SIZE })
  // Calls only reach functions that exist.
  .map((bodies) => bodies.map((calls) => calls.map((c) => ({ ...c, to: c.to % bodies.length }))));

describe('recursion in generated call graphs', () => {
  it('adds 1 to exactly the functions that reach themselves through real calls', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Form>('declaration', 'arrow', 'method'),
        graphs,
        (form, bodies) => {
          const { functions } = parse('generated.ts', source(form, bodies), COUNT_ALL);
          const complexity = Object.fromEntries(functions.map((fn) => [fn.name, fn.complexity]));
          const expected = Object.fromEntries(
            inCycles(bodies).map((cyclic, i) => [name(i), cyclic ? 2 : 1]),
          );
          expect(complexity).toEqual(expected);
        },
      ),
      { numRuns: 500 },
    );
  });
});
