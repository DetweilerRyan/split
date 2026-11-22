import { describe, expect, it } from 'vitest';
import { baseOf, globToRegExp, literal } from './glob.ts';

const matches = (glob: string, path: string) => globToRegExp(glob).test(path);

describe('globToRegExp', () => {
  it.each([
    ['**/*.ts', 'a.ts', true],
    ['**/*.ts', 'src/deep/a.ts', true],
    ['**/*.ts', 'src/a.tsx', false],
    ['src/*.ts', 'src/a.ts', true],
    ['src/*.ts', 'src/deep/a.ts', false],
    ['src/**', 'src/deep/a.ts', true],
    ['src/**', 'srcs/a.ts', false],
    ['src/**/*.{ts,tsx}', 'src/a.tsx', true],
    ['src/**/*.{ts,tsx}', 'src/a.js', false],
    ['src/?.ts', 'src/a.ts', true],
    ['src/?.ts', 'src/ab.ts', false],
    ['**/*.test.*', 'src/a.test.ts', true],
    ['**/*.test.*', 'src/a.ts', false],
  ])('%s against %s is %s', (glob, path, expected) => {
    expect(matches(glob, path)).toBe(expected);
  });

  it('matches a folder an ignore pattern names, written with a trailing slash', () => {
    expect(matches('**/node_modules/**', 'src/node_modules/')).toBe(true);
    expect(matches('**/.*/**', '.cache/')).toBe(true);
    expect(matches('**/.*/**', 'src/.cache/')).toBe(true);
    expect(matches('**/.*/**', 'src/')).toBe(false);
  });

  it('takes a character after a backslash literally, and other regex characters as they are', () => {
    expect(matches('src/\\*.ts', 'src/*.ts')).toBe(true);
    expect(matches('src/\\*.ts', 'src/a.ts')).toBe(false);
    expect(matches('src/(a)+[b].ts', 'src/(a)+[b].ts')).toBe(true);
  });
});

describe('baseOf', () => {
  it('is the folders before the first wildcard', () => {
    expect([
      baseOf('src/**/*.ts'),
      baseOf('src/utils/*.ts'),
      baseOf('**/*.ts'),
      baseOf('a.ts'),
    ]).toEqual(['src', 'src/utils', '.', '.']);
  });

  it('is the folder of a literal file', () => {
    expect(baseOf(literal('src/utils/math.ts'))).toBe('src/utils');
  });
});

describe('literal', () => {
  it('makes a glob that matches only the path itself', () => {
    expect(matches(literal('src/{a}.ts'), 'src/{a}.ts')).toBe(true);
    expect(matches(literal('src/*.ts'), 'src/a.ts')).toBe(false);
  });
});
