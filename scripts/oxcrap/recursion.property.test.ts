import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { COUNT_ALL } from './complexity.ts';
import { parse } from './functions.ts';

// Random call graphs among a few functions, written in the forms oxCrap resolves, with decoy calls
// that must never count. The expected answer comes from a simpler version of the same question: a
// function is in a recursion cycle exactly when a plain search from it reaches it again. That
// shares nothing with the strongly-connected-components pass recursion.ts uses.
// - **A call that a binding hides:** a parameter, a default-valued parameter, a `for` loop's `let`,
//   a `for-in` loop's `const` or a destructured `const` of the same name. The call reaches that
//   binding, so it's no call to the function.
// - **A binding that doesn't hide it:** one in a sibling block, or a nested function's parameter
//   around a different call. The call still reaches the function.
// - **Not generated:** the bindings #87 lists as resolved wrongly, a static block's locals, a
//   default parameter that sees the body's `const`, private methods, a method and a field of the
//   same name, and a catch parameter that a `var` declares again.

/** How the functions are written: as declarations, const arrows, or methods of one class. */
type Form = 'declaration' | 'arrow' | 'method';
/** A binding of the called name that hides the call from the function. */
type Hiding = 'param' | 'defaultParam' | 'forLet' | 'forInConst' | 'destructured';
/** A binding of the same name beside the call that leaves it reaching the function. */
type Nearby = 'none' | 'siblingBlock' | 'nestedParam';
/** A call in a function's body: to another function, or a decoy that must not count. */
type Call = {
  to: number;
  decoy: 'none' | 'shadowed' | 'otherObject' | 'nestedThis';
  hiding: Hiding;
  nearby: Nearby;
};

const SIZE = 5;
function name(i: number) {
  return `f${i}`;
}

/** A call of `name` that a binding of the same name hides, written as `hiding` says. */
function hiddenCall(hiding: Hiding, name: string) {
  switch (hiding) {
    case 'param':
      return `((${name}) => ${name}())(() => 0);`;
    case 'defaultParam':
      return `((${name} = () => 0) => ${name}())();`;
    case 'forLet':
      return `for (let ${name} = () => 0; ; ) ${name}();`;
    case 'forInConst':
      return `for (const ${name} in {}) ${name}();`;
    default:
      return `{ const { ${name} } = { ${name}: () => 0 }; ${name}(); }`;
  }
}

/** The branches a hiding form adds of its own: a default value or a loop. */
function hidingBranches(hiding: Hiding) {
  switch (hiding) {
    case 'defaultParam':
    case 'forLet':
    case 'forInConst':
      return 1;
    default:
      return 0;
  }
}

/** A binding of `name` beside a call, which mustn't hide the call. */
function nearbyCode(nearby: Nearby, name: string) {
  switch (nearby) {
    case 'siblingBlock':
      return `{ const ${name} = 0; void ${name}; } `;
    case 'nestedParam':
      return `((${name}) => other())(0); `;
    default:
      return '';
  }
}

/** A call written so it reaches function `to`, or so it looks like it does but mustn't. */
function callCode(form: Form, { to, decoy, hiding, nearby }: Call) {
  const target = form === 'method' ? `this.${name(to)}` : name(to);
  switch (decoy) {
    case 'none':
      return `${nearbyCode(nearby, name(to))}${target}();`;
    // A binding of the same name hides the function.
    case 'shadowed':
      return hiddenCall(hiding, name(to));
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

/** The branches a function's calls add of their own, apart from recursion. */
function branches(calls: Call[]) {
  return calls
    .filter((c) => c.decoy === 'shadowed')
    .reduce((sum, c) => sum + hidingBranches(c.hiding), 0);
}

const call = fc.record<Call>({
  to: fc.nat({ max: SIZE - 1 }),
  decoy: fc.constantFrom('none', 'none', 'shadowed', 'shadowed', 'otherObject', 'nestedThis'),
  hiding: fc.constantFrom<Hiding>('param', 'defaultParam', 'forLet', 'forInConst', 'destructured'),
  nearby: fc.constantFrom<Nearby>('none', 'siblingBlock', 'nestedParam'),
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
          const cycles = inCycles(bodies);
          const expected = Object.fromEntries(
            bodies.map((calls, i) => [name(i), 1 + branches(calls) + (cycles[i] ? 1 : 0)]),
          );
          expect(complexity).toEqual(expected);
        },
      ),
      { numRuns: 500 },
    );
  });
});
