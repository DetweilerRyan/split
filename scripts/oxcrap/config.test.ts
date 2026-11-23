import { describe, expect, it } from 'vitest';
import { DEFAULTS, merge, OPTIONS, parseConfig } from './config.ts';
import schemaFile from './configuration_schema.json' with { type: 'json' };

const schema = schemaFile as {
  properties: Record<
    string,
    { default?: unknown; properties?: Record<string, { default?: unknown }> }
  >;
};

describe('parseConfig', () => {
  it('reads each option, with comments and trailing commas, as oxlint’s and oxfmt’s configs allow', () => {
    const text = `{
      // A line comment.
      "$schema": "./schema.json",
      "files": ["src/**", ], /* a block comment */
      "ignorePatterns": ["**/*.test.*"],
      "limits": { "crap": 40, },
      "coverage": "coverage/coverage-final.json",
      "helpUrl": "docs/crap.md",
    } // after`;
    expect(parseConfig(text, 'c.json')).toEqual({
      files: ['src/**'],
      ignorePatterns: ['**/*.test.*'],
      limits: { crap: 40, complexity: 10 },
      coverage: 'coverage/coverage-final.json',
      helpUrl: 'docs/crap.md',
    });
  });

  it.each([
    ["{ 'files': [] }", 'single quotes'],
    ['{ files: [] }', 'an unquoted key'],
    ['{ "limits": { "crap": 0x20 } }', 'a hex number'],
    ['{ "limits": { "crap": 1_0 } }', 'a numeric separator'],
    ['{ "files": ', 'unfinished JSON'],
  ])('refuses JSON5 and JavaScript syntax that oxlint refuses too: %s', (text) => {
    expect(() => parseConfig(text, 'c.json')).toThrow(/^c\.json isn't valid JSON at 1:\d+: /);
  });

  it('says where the JSON goes wrong, by line and column', () => {
    expect(() => parseConfig('{\n  "files": [\n    "a" "b"\n  ]\n}', 'c.json')).toThrow(
      "c.json isn't valid JSON at 3:9: CommaExpected.",
    );
  });

  it.each([
    [
      '{ "file": ["src/**"] }',
      'c.json has no option "file". The options are files, ignorePatterns, limits, counting, coverage, helpUrl.',
    ],
    ['{ "limits": { "score": 30 } }', 'c.json: "limits" has no option "score".'],
    ['[]', 'c.json must be object.'],
    ['{ "files": "src/**" }', 'c.json: "files" must be array.'],
    ['{ "files": [] }', 'c.json: "files" must NOT have fewer than 1 items.'],
    ['{ "ignorePatterns": [1] }', 'c.json: "ignorePatterns.0" must be string.'],
    ['{ "limits": 30 }', 'c.json: "limits" must be object.'],
    ['{ "limits": { "crap": 0 } }', 'c.json: "limits.crap" must be > 0.'],
    ['{ "limits": { "complexity": "10" } }', 'c.json: "limits.complexity" must be number.'],
    ['{ "coverage": "" }', 'c.json: "coverage" must NOT have fewer than 1 characters.'],
    ['{ "$schema": 1 }', 'c.json: "$schema" must be string.'],
    ['{\n  "__proto__": { "helpUrl": "x" }\n}', 'c.json has no option "__proto__", at 2:3.'],
  ])('checks %s against the schema', (text, message) => {
    expect(() => parseConfig(text, 'c.json')).toThrow(message);
  });

  it('lays a config’s counting over the defaults, one option at a time', () => {
    expect(parseConfig('{ "counting": { "nestedFunctions": "own" } }', 'c.json').counting).toEqual({
      ...DEFAULTS.counting,
      nestedFunctions: 'own',
    });
  });

  it.each([
    [
      '{ "counting": { "nestedFunctions": "inner" } }',
      'c.json: "counting.nestedFunctions" must be equal to one of the allowed values.',
    ],
    [
      '{ "counting": { "defaultValues": "yes" } }',
      'c.json: "counting.defaultValues" must be boolean.',
    ],
  ])('checks counting %s against the schema', (text, message) => {
    expect(() => parseConfig(text, 'c.json')).toThrow(message);
  });

  it('reports every problem at once, one per line', () => {
    expect(() =>
      parseConfig('{ "file": 1, "limits": { "crap": 0, "complexity": -1 } }', 'c.json'),
    ).toThrow(
      [
        'c.json has no option "file". The options are files, ignorePatterns, limits, counting, coverage, helpUrl.',
        'c.json: "limits.crap" must be > 0.',
        'c.json: "limits.complexity" must be > 0.',
      ].join('\n'),
    );
  });
});

describe('merge', () => {
  it('lays a config over the defaults, and the command line over both, skipping what a layer leaves unset', () => {
    expect(
      merge({ files: ['src/**'], helpUrl: 'a.md' }, { files: undefined, helpUrl: 'b.md' }),
    ).toEqual({
      ...DEFAULTS,
      files: ['src/**'],
      helpUrl: 'b.md',
    });
  });
});

describe('configuration_schema.json', () => {
  it('names the options that OPTIONS and the error messages list', () => {
    expect(OPTIONS).toEqual([
      'files',
      'ignorePatterns',
      'limits',
      'counting',
      'coverage',
      'helpUrl',
    ]);
  });

  it('gives the same defaults as the code', () => {
    expect(schema.properties.files.default).toEqual(DEFAULTS.files);
    expect(schema.properties.ignorePatterns.default).toEqual(DEFAULTS.ignorePatterns);
    expect(schema.properties.limits.properties?.crap.default).toBe(DEFAULTS.limits.crap);
    expect(schema.properties.limits.properties?.complexity.default).toBe(
      DEFAULTS.limits.complexity,
    );
    const counting = schema.properties.counting.properties!;
    expect({
      nestedFunctions: counting.nestedFunctions.default,
      defaultValues: counting.defaultValues.default,
      optionalChaining: counting.optionalChaining.default,
    }).toEqual(DEFAULTS.counting);
  });
});
