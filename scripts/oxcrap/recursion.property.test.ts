import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { COUNT_ALL } from './complexity.ts';
import { parse } from './functions.ts';

// Random call graphs among a few functions, written in the forms oxCrap resolves, with decoy calls
// that must never count. The expected answer comes from a simpler version of the same question: a
// function is in a recursion cycle exactly when a plain search from it reaches it again. That
// shares nothing with the strongly-connected-components pass recursion.ts uses.
// - **How a call is written:** a plain call, `new` on a declared function, or a call in a default
//   value, of a parameter or in a pattern, past a body `const` of the same name.
// - **A call that a binding hides:** a parameter, a default-valued parameter, an earlier parameter
//   seen from a default value, a `for` loop's `let`, a `for-in` loop's `const`, a destructured
//   `const`, a body's `var` hoisted out of a block, a static block's `const` or `var`, or a body's
//   `const` in a function with a default value. The call reaches that binding, so it's no call to
//   the function.
// - **A binding that doesn't hide it:** one in a sibling block, a nested function's parameter
//   around a different call, or a static block's `var`. The call still reaches the function.
// - **The class around methods:** public, private or static methods. Each has a stub of the same
//   name that `this` mustn't reach: in the other privacy, which a decoy calls, or for a static
//   method, on the instance. A public or static method may have a field of its name, before or
//   after it, on its own side, which hides it from `this`, or on the other side, which doesn't.
//   `this` in an inner class's static block or field is that class or its instance, so a call
//   through it is a decoy.

/** How the functions are written: as declarations, const arrows, or public, private or static methods. */
type Form = 'declaration' | 'arrow' | 'method' | 'private' | 'static';
/** How a real call is written. */
type Via = 'call' | 'new' | 'defaultValue' | 'patternDefault';
/** A binding of the called name that hides the call from the function. */
type Hiding =
  | 'param'
  | 'defaultParam'
  | 'earlierParam'
  | 'forLet'
  | 'forInConst'
  | 'destructured'
  | 'bodyVar'
  | 'staticConst'
  | 'staticVar'
  | 'bodyPastDefault';
/** A binding of the same name beside the call that leaves it reaching the function. */
type Nearby = 'none' | 'siblingBlock' | 'nestedParam' | 'staticVar';
/**
 * A field of a method's name: on the method's own side, instance or static, it hides the method
 * from `this`; on the other side it doesn't.
 */
type Field = 'none' | 'sameBefore' | 'sameAfter' | 'other';
/** A call in a function's body: to another function, or a decoy that must not count. */
type Call = {
  to: number;
  decoy:
    | 'none'
    | 'shadowed'
    | 'otherObject'
    | 'nestedThis'
    | 'otherPrivacy'
    | 'innerStatic'
    | 'innerField';
  via: Via;
  hiding: Hiding;
  nearby: Nearby;
};
type Fn = { calls: Call[]; field: Field };
type Program = { form: Form; stubsFirst: boolean; fns: Fn[] };

const SIZE = 5;
function name(i: number) {
  return `f${i}`;
}

/** Whether the functions are a class's methods. */
function inClass(form: Form) {
  return form === 'method' || form === 'private' || form === 'static';
}

/** A call of `name` that a binding of the same name hides, written as `hiding` says. */
function hiddenCall(hiding: Hiding, name: string) {
  switch (hiding) {
    case 'param':
      return `((${name}) => ${name}())(() => 0);`;
    case 'defaultParam':
      return `((${name} = () => 0) => ${name}())();`;
    // A default value sees the parameters before it.
    case 'earlierParam':
      return `((${name} = () => 0, n = ${name}()) => n)();`;
    case 'forLet':
      return `for (let ${name} = () => 0; ; ) ${name}();`;
    case 'forInConst':
      return `for (const ${name} in {}) ${name}();`;
    case 'bodyVar':
      return `(() => { { var ${name} = () => 0; } return ${name}(); })();`;
    case 'staticConst':
      return `void class { static { const ${name} = () => 0; ${name}(); } };`;
    case 'staticVar':
      return `void class { static { var ${name} = () => 0; ${name}(); } };`;
    // The body's own scope still hides the name from the body.
    case 'bodyPastDefault':
      return `((n = 0) => { const ${name} = () => n; return ${name}(); })();`;
    default:
      return `{ const { ${name} } = { ${name}: () => 0 }; ${name}(); }`;
  }
}

/** The branches a hiding form adds of its own: default values or a loop. */
function hidingBranches(hiding: Hiding) {
  switch (hiding) {
    case 'earlierParam':
      return 2;
    case 'defaultParam':
    case 'forLet':
    case 'forInConst':
    case 'bodyPastDefault':
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
    // A static block's `var` stays in the block.
    case 'staticVar':
      return `void class { static { var ${name} = 0; } }; `;
    default:
      return '';
  }
}

/** What reaches function `to`: its name, or `this` and its name, public or private. */
function callee(form: Form, to: number) {
  switch (form) {
    case 'method':
    case 'static':
      return `this.${name(to)}`;
    case 'private':
      return `this.#${name(to)}`;
    default:
      return name(to);
  }
}

/** A real call of `to`, written as `via` says. A default value sees past the body's `const`. */
function realCall(form: Form, via: Via, to: number) {
  const fn = callee(form, to);
  switch (via) {
    // Only a declared function can be called with `new`; the others call it plainly.
    case 'new':
      return form === 'declaration' ? `new ${fn}();` : `${fn}();`;
    case 'defaultValue':
      return `((n = ${fn}()) => { const ${name(to)} = 0; return n + ${name(to)}; })();`;
    case 'patternDefault':
      return `(({ n = ${fn}() }) => { const ${name(to)} = 0; return n + ${name(to)}; })({});`;
    default:
      return `${fn}();`;
  }
}

/** The branches a real call adds of its own: a default value. */
function viaBranches(via: Via) {
  switch (via) {
    case 'defaultValue':
    case 'patternDefault':
      return 1;
    default:
      return 0;
  }
}

/**
 * A call of the stub with function `to`'s name in the other privacy, which isn't the function. A
 * static method's `this` can't reach the instance's stub, so it calls nothing.
 */
function otherPrivacy(form: Form, to: number) {
  switch (form) {
    case 'method':
      return `this.#${name(to)}();`;
    case 'private':
      return `this.${name(to)}();`;
    default:
      return 'void 0;';
  }
}

/** A call written so it reaches function `to`, or so it looks like it does but mustn't. */
function callCode(form: Form, { to, decoy, via, hiding, nearby }: Call) {
  switch (decoy) {
    case 'none':
      return `${nearbyCode(nearby, name(to))}${realCall(form, via, to)}`;
    // A binding of the same name hides the function.
    case 'shadowed':
      return hiddenCall(hiding, name(to));
    // Another object's method of the same name isn't this one.
    case 'otherObject':
      return `other.${name(to)}();`;
    // A non-arrow function has its own `this`; with plain functions it's just a nested call.
    case 'nestedThis':
      return inClass(form) ? `(function () { return ${callee(form, to)}(); })();` : `void 0;`;
    case 'otherPrivacy':
      return otherPrivacy(form, to);
    // An inner class's static block has the inner class as its `this`, and its field the instance.
    case 'innerStatic':
      return inClass(form) ? `void class { static { ${callee(form, to)}(); } };` : `void 0;`;
    case 'innerField':
      return inClass(form) ? `void class { x = ${callee(form, to)}(); };` : `void 0;`;
  }
}

/**
 * A public or static method with the field of its name that `field` says: on its own side,
 * before or after it, or on the other side.
 */
function withField(form: Form, field: Field, method: string, name: string) {
  const own = form === 'static' ? `  static ${name} = 0;` : `  ${name} = 0;`;
  const other = form === 'static' ? `  ${name} = 0;` : `  static ${name} = 0;`;
  switch (field) {
    case 'sameBefore':
      return `${own}\n${method}`;
    case 'sameAfter':
      return `${method}\n${own}`;
    case 'other':
      return `${method}\n${other}`;
    default:
      return method;
  }
}

/** The prefix of each stub's name: private for public methods, and public otherwise. */
function stubPrefix(form: Form) {
  return form === 'method' ? '#' : '';
}

/** A class of the methods, with a stub of each one's name that `this` mustn't reach. */
function classSource(form: Form, stubsFirst: boolean, methods: string[]) {
  const stubs = methods.map((_, i) => `  ${stubPrefix(form)}${name(i)}() { return 0; }`);
  const members = stubsFirst ? [...stubs, ...methods] : [...methods, ...stubs];
  return `class C {\n${members.join('\n')}\n}\n`;
}

/** A function's header and body, as `form` writes it. */
function written(form: Form, { calls, field }: Fn, i: number) {
  const body = calls.map((call) => `  ${callCode(form, call)}`).join('\n');
  switch (form) {
    case 'declaration':
      return `function ${name(i)}() {\n${body}\n}`;
    case 'arrow':
      return `const ${name(i)} = () => {\n${body}\n};`;
    case 'private':
      return `  #${name(i)}() {\n${body}\n  }`;
    case 'static':
      return withField(form, field, `  static ${name(i)}() {\n${body}\n  }`, name(i));
    default:
      return withField(form, field, `  ${name(i)}() {\n${body}\n  }`, name(i));
  }
}

function source({ form, stubsFirst, fns }: Program) {
  const fnsWritten = fns.map((fn, i) => written(form, fn, i));
  return inClass(form) ? classSource(form, stubsFirst, fnsWritten) : `${fnsWritten.join('\n')}\n`;
}

/** Whether `this` reaches function `i`: a field of its name on its own side hides it. */
function reachable({ form, fns }: Program, i: number) {
  const hides = fns[i].field === 'sameBefore' || fns[i].field === 'sameAfter';
  return !(hides && (form === 'method' || form === 'static'));
}

/** The functions that reach themselves, following only the real calls. */
function inCycles(program: Program) {
  const edges = program.fns.map(({ calls }) =>
    calls.filter((c) => c.decoy === 'none' && reachable(program, c.to)).map((c) => c.to),
  );
  return edges.map((_, start) => {
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
  return calls.reduce((sum, c) => {
    if (c.decoy === 'shadowed') return sum + hidingBranches(c.hiding);
    return c.decoy === 'none' ? sum + viaBranches(c.via) : sum;
  }, 0);
}

/** A list of scored functions as `name complexity` lines, in one order, to compare. */
function sorted(scored: (string | number)[][]) {
  return scored.map(([fn, complexity]) => `${fn} ${complexity}`).sort();
}

/** Each scored function's expected complexity, with the name oxCrap reports it under. */
function expected(program: Program) {
  const cycles = inCycles(program);
  const scored = program.fns.map(({ calls }, i) => [
    program.form === 'private' ? `#${name(i)}` : name(i),
    1 + branches(calls) + (cycles[i] ? 1 : 0),
  ]);
  // The stubs call nothing.
  const stubs = inClass(program.form)
    ? program.fns.map((_, i) => [`${stubPrefix(program.form)}${name(i)}`, 1])
    : [];
  return sorted([...scored, ...stubs]);
}

const call = fc.record<Call>({
  to: fc.nat({ max: SIZE - 1 }),
  decoy: fc.constantFrom(
    'none',
    'none',
    'none',
    'shadowed',
    'shadowed',
    'otherObject',
    'nestedThis',
    'otherPrivacy',
    'innerStatic',
    'innerField',
  ),
  via: fc.constantFrom<Via>('call', 'new', 'defaultValue', 'patternDefault'),
  hiding: fc.constantFrom<Hiding>(
    'param',
    'defaultParam',
    'earlierParam',
    'forLet',
    'forInConst',
    'destructured',
    'bodyVar',
    'staticConst',
    'staticVar',
    'bodyPastDefault',
  ),
  nearby: fc.constantFrom<Nearby>('none', 'siblingBlock', 'nestedParam', 'staticVar'),
});
const fn = fc.record<Fn>({
  calls: fc.array(call, { maxLength: 3 }),
  field: fc.constantFrom<Field>('none', 'none', 'sameBefore', 'sameAfter', 'other'),
});
const programs = fc
  .record({
    form: fc.constantFrom<Form>('declaration', 'arrow', 'method', 'private', 'static'),
    stubsFirst: fc.boolean(),
    fns: fc.array(fn, { minLength: 1, maxLength: SIZE }),
  })
  // Calls only reach functions that exist.
  .map((program) => ({
    ...program,
    fns: program.fns.map((f) => ({
      ...f,
      calls: f.calls.map((c) => ({ ...c, to: c.to % program.fns.length })),
    })),
  }));

describe('recursion in generated call graphs', () => {
  it('adds 1 to exactly the functions that reach themselves through real calls', () => {
    fc.assert(
      fc.property(programs, (program) => {
        const { functions } = parse('generated.ts', source(program), COUNT_ALL);
        const complexity = sorted(functions.map((f) => [f.name, f.complexity]));
        expect(complexity).toEqual(expected(program));
      }),
      { numRuns: 500 },
    );
  });
});
