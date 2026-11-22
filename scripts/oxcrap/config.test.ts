import { describe, expect, it } from 'vitest';
import { DEFAULTS, merge, OPTIONS, parseConfig, readJsonc } from './config.ts';
import schemaFile from './configuration_schema.json';

const schema = schemaFile as {
  properties: Record<
    string,
    { default?: unknown; properties?: Record<string, { default?: unknown }> }
  >;
};

describe('readJsonc', () => {
  it('reads JSON with comments and trailing commas, as oxlint’s and oxfmt’s configs allow', () => {
    const text = `{
      // A line comment.
      "files": ["src/**", ], /* a block comment */
      "limits": { "crap": 40, "complexity": -1.5, },
      "guide": null,
      "on": true,
    } // after`;
    expect(readJsonc(text, 'c.json')).toEqual({
      files: ['src/**'],
      limits: { crap: 40, complexity: -1.5 },
      guide: null,
      on: true,
    });
  });

  it('refuses text that isn’t JSON, naming the file', () => {
    expect(() => readJsonc('{ "a": ', 'c.json')).toThrow("c.json isn't valid JSON");
    expect(() => readJsonc('{ "a": 1 } { "b": 2 }', 'c.json')).toThrow("c.json isn't valid JSON");
    expect(() => readJsonc('{ "a": f() }', 'c.json')).toThrow(
      "c.json isn't JSON: it has a CallExpression.",
    );
    expect(() => readJsonc('{ [a]: 1 }', 'c.json')).toThrow('an object key must be a string');
  });
});

describe('parseConfig', () => {
  it('reads each option', () => {
    const text = `{
      "$schema": "./schema.json",
      "files": ["src/**"],
      "ignorePatterns": ["**/*.test.*"],
      "limits": { "crap": 40 },
      "coverage": "coverage/coverage-final.json",
      "guide": "docs/crap.md"
    }`;
    expect(parseConfig(text, 'c.json')).toEqual({
      files: ['src/**'],
      ignorePatterns: ['**/*.test.*'],
      limits: { crap: 40, complexity: 10 },
      coverage: 'coverage/coverage-final.json',
      guide: 'docs/crap.md',
    });
  });

  it.each([
    ['[]', 'c.json should hold one object of options.'],
    [
      '{ "file": ["src/**"] }',
      'c.json has no option "file". The options are files, ignorePatterns, limits, coverage, guide.',
    ],
    ['{ "files": "src/**" }', 'c.json: "files" should be a list of globs.'],
    ['{ "files": [] }', 'c.json: "files" should be at least one glob.'],
    ['{ "ignorePatterns": [1] }', 'c.json: "ignorePatterns" should be a list of globs.'],
    [
      '{ "limits": 30 }',
      'c.json: "limits" should be an object such as { "crap": 30, "complexity": 10 }.',
    ],
    [
      '{ "limits": { "score": 30 } }',
      'c.json: "limits" has no option "score"; it takes "crap" and "complexity".',
    ],
    ['{ "limits": { "crap": 0 } }', 'c.json: "limits.crap" should be a number above 0.'],
    [
      '{ "limits": { "complexity": "10" } }',
      'c.json: "limits.complexity" should be a number above 0.',
    ],
    ['{ "coverage": "" }', 'c.json: "coverage" should be a path.'],
    ['{ "$schema": 1 }', 'c.json: "$schema" should be a string.'],
  ])('refuses %s', (text, message) => {
    expect(() => parseConfig(text, 'c.json')).toThrow(message);
  });
});

describe('merge', () => {
  it('lays a config over the defaults, and the command line over both, skipping what a layer leaves unset', () => {
    expect(
      merge({ files: ['src/**'], guide: 'a.md' }, { files: undefined, guide: 'b.md' }),
    ).toEqual({
      ...DEFAULTS,
      files: ['src/**'],
      guide: 'b.md',
    });
  });
});

describe('configuration_schema.json', () => {
  it('lists exactly the options parseConfig reads', () => {
    expect(Object.keys(schema.properties).sort()).toEqual([...OPTIONS].sort());
  });

  it('gives the same defaults as the code', () => {
    expect(schema.properties.files.default).toEqual(DEFAULTS.files);
    expect(schema.properties.ignorePatterns.default).toEqual(DEFAULTS.ignorePatterns);
    expect(schema.properties.limits.properties?.crap.default).toBe(DEFAULTS.limits.crap);
    expect(schema.properties.limits.properties?.complexity.default).toBe(
      DEFAULTS.limits.complexity,
    );
  });
});
