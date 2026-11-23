import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parse } from './functions.ts';

// Random functions from a small grammar that knows how many branches it writes, so the expected
// complexity comes from the generator, not from running the counter. fast-check shrinks a failure
// to the smallest function that breaks the count. The code is only parsed, never run, so its names
// needn't exist.
type Code = { code: string; branches: number };
const join = (parts: Code[]): Code => ({
  code: parts.map((part) => part.code).join('\n'),
  branches: parts.reduce((sum, part) => sum + part.branches, 0),
});
/** `code` wrapped around `inner`, adding `added` branches of its own. */
const wrap = (code: string, added: number, ...inner: Code[]): Code => ({
  code,
  branches: added + inner.reduce((sum, part) => sum + part.branches, 0),
});

const { statements } = fc.letrec<{ statement: Code; statements: Code }>((tie) => {
  const body = tie('statements');
  return {
    statements: fc.array(tie('statement'), { maxLength: 3 }).map(join),
    statement: fc.oneof(
      { depthSize: 'small', withCrossShrink: true },
      // No branch.
      fc.constantFrom<Code>(
        { code: 'n++;', branches: 0 },
        { code: 'void obj?.a?.b;', branches: 0 },
        { code: 'n = n + 1;', branches: 0 },
      ),
      // Expressions: a ?: over a chain of && adds one per operator, and one for the ?:.
      fc.integer({ min: 1, max: 4 }).map((operators) => ({
        code: `n = ${Array.from({ length: operators + 1 }, (_, i) => `x${i}`).join(' && ')} ? 1 : 0;`,
        branches: operators + 1,
      })),
      fc.constantFrom('||=', '&&=', '??=').map((operator) => ({
        code: `n ${operator} 1;`,
        branches: 1,
      })),
      fc.constant<Code>({ code: 'n = obj?.x ?? 0;', branches: 1 }),
      // Statements that branch, around bodies of their own.
      body.map((s) => wrap(`if (a) {\n${s.code}\n}`, 1, s)),
      fc
        .tuple(body, body)
        .map(([s, t]) => wrap(`if (a) {\n${s.code}\n} else {\n${t.code}\n}`, 1, s, t)),
      fc
        .tuple(body, body, body)
        .map(([s, t, u]) =>
          wrap(
            `if (a) {\n${s.code}\n} else if (b) {\n${t.code}\n} else {\n${u.code}\n}`,
            2,
            s,
            t,
            u,
          ),
        ),
      body.map((s) => wrap(`for (let i = 0; i < n; i++) {\n${s.code}\n}`, 1, s)),
      body.map((s) => wrap(`for (const x of xs) {\n${s.code}\n}`, 1, s)),
      body.map((s) => wrap(`for (const k in obj) {\n${s.code}\n}`, 1, s)),
      body.map((s) => wrap(`while (n < 10) {\n${s.code}\n}`, 1, s)),
      body.map((s) => wrap(`do {\n${s.code}\n} while (n < 10);`, 1, s)),
      fc
        .tuple(body, body)
        .map(([s, t]) => wrap(`try {\n${s.code}\n} catch {\n${t.code}\n}`, 1, s, t)),
      body.map((s) => wrap(`try {\n${s.code}\n} finally {\n}`, 0, s)),
      fc
        .tuple(body, body, body)
        .map(([s, t, u]) =>
          wrap(`try {\n${s.code}\n} catch {\n${t.code}\n} finally {\n${u.code}\n}`, 1, s, t, u),
        ),
      fc
        .tuple(fc.array(body, { minLength: 1, maxLength: 3 }), fc.boolean())
        .map(([cases, withDefault]) =>
          wrap(
            `switch (n) {\n${cases.map((c, i) => `case ${i}: {\n${c.code}\nbreak;\n}`).join('\n')}${withDefault ? '\ndefault:\nbreak;' : ''}\n}`,
            cases.length,
            ...cases,
          ),
        ),
      // A nested function is scored on its own, so its branches don't count here.
      fc
        .tuple(body, fc.nat({ max: 999 }))
        .map(([s, id]) => ({ code: `const inner${id} = () => {\n${s.code}\n};`, branches: 0 })),
    ),
  };
});

describe('complexity of generated functions', () => {
  it('is 1 plus the branches in the function’s own body', () => {
    fc.assert(
      fc.property(statements, ({ code, branches }) => {
        const source = `export function subject() {\n${code}\n}\n`;
        const subject = parse('generated.ts', source).functions.find((fn) => fn.name === 'subject');
        expect(subject?.complexity).toBe(1 + branches);
      }),
      { numRuns: 300 },
    );
  });
});
