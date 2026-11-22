// Reads an .oxcraprc.json config: JSON with comments and trailing commas allowed, as oxlint's and
// oxfmt's configs are. configuration_schema.json beside this file describes the same options for
// editors; config.test.ts checks the two agree.
import { parseSync } from 'oxc-parser';
import { type AstNode, isNode } from './complexity.ts';

export type Limits = { crap: number; complexity: number };
export type Config = {
  /** Globs of the files to score, from the config's folder. */
  files: string[];
  /** Globs left out of scoring. A folder that matches isn't searched at all. */
  ignorePatterns: string[];
  limits: Limits;
  /** The istanbul JSON coverage report, from the config's folder. */
  coverage?: string;
  /** A document the findings point to. */
  guide?: string;
};

/** The names oxCrap looks for in the current directory when no config is given, in order. */
export const CONFIG_NAMES = ['.oxcraprc.json', '.oxcraprc.jsonc'];

export const CODE_FILES = '**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}';

export const DEFAULTS: Config = {
  files: [CODE_FILES],
  ignorePatterns: ['**/node_modules/**', '**/.*/**', '**/*.test.*', '**/*.spec.*'],
  limits: { crap: 30, complexity: 10 },
};

/** The options a config may set, with `$schema` for editors. */
export const OPTIONS = ['$schema', 'files', 'ignorePatterns', 'limits', 'coverage', 'guide'];

export class ConfigError extends Error {}

/** The value of a JSON literal in an oxc-parser AST, or an error naming what isn't JSON. */
function value(node: AstNode, path: string): unknown {
  switch (node.type) {
    case 'ObjectExpression': {
      const object: Record<string, unknown> = {};
      for (const property of node.properties as AstNode[]) {
        const key = property.key as AstNode | undefined;
        const name =
          key?.type === 'Literal' ? key.value : key?.type === 'Identifier' ? key.name : undefined;
        if (property.type !== 'Property' || property.computed || typeof name !== 'string') {
          throw new ConfigError(`${path} isn't JSON: an object key must be a string.`);
        }
        object[name] = value(property.value as AstNode, path);
      }
      return object;
    }
    case 'ArrayExpression':
      return (node.elements as (AstNode | null)[]).map((element) => {
        if (!element) throw new ConfigError(`${path} isn't JSON: an array has a hole in it.`);
        return value(element, path);
      });
    case 'Literal':
      if (node.regex) throw new ConfigError(`${path} isn't JSON: it has a regular expression.`);
      return node.value;
    case 'UnaryExpression': {
      const argument = node.argument as AstNode;
      if (
        node.operator === '-' &&
        argument.type === 'Literal' &&
        typeof argument.value === 'number'
      ) {
        return -argument.value;
      }
      break;
    }
  }
  throw new ConfigError(`${path} isn't JSON: it has a ${node.type}.`);
}

/** Reads JSON text, allowing comments and trailing commas. */
export function readJsonc(text: string, path: string): unknown {
  // A line comment at the end would swallow the closing parenthesis on the same line.
  const result = parseSync('config.ts', `(${text}\n)`);
  const statement = (result.program as unknown as { body: AstNode[] }).body;
  if (result.errors.length > 0 || statement.length !== 1 || !isNode(statement[0].expression)) {
    const why = result.errors[0]?.message ?? 'expected one JSON value';
    throw new ConfigError(`${path} isn't valid JSON: ${why}`);
  }
  // oxc-parser keeps the parentheses this wraps the text in; the JSON value is inside them.
  const wrapped = statement[0].expression as AstNode;
  return value(
    wrapped.type === 'ParenthesizedExpression' ? (wrapped.expression as AstNode) : wrapped,
    path,
  );
}

const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((item) => typeof item === 'string');

/** The options a config sets, checked; what it leaves out comes from DEFAULTS when merged. */
export function parseConfig(text: string, path: string): Partial<Config> {
  const raw = readJsonc(text, path);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ConfigError(`${path} should hold one object of options.`);
  }
  const options = raw as Record<string, unknown>;
  const config: Partial<Config> = {};
  for (const [key, setting] of Object.entries(options)) {
    const problem = (expected: string) =>
      new ConfigError(`${path}: "${key}" should be ${expected}.`);
    switch (key) {
      case '$schema':
        if (typeof setting !== 'string') throw problem('a string');
        break;
      case 'files':
      case 'ignorePatterns':
        if (!isStrings(setting)) throw problem('a list of globs');
        if (key === 'files' && setting.length === 0) throw problem('at least one glob');
        config[key] = setting;
        break;
      case 'limits': {
        if (!setting || typeof setting !== 'object' || Array.isArray(setting)) {
          throw problem('an object such as { "crap": 30, "complexity": 10 }');
        }
        const limits = { ...DEFAULTS.limits };
        for (const [name, limit] of Object.entries(setting)) {
          if (name !== 'crap' && name !== 'complexity') {
            throw new ConfigError(
              `${path}: "limits" has no option "${name}"; it takes "crap" and "complexity".`,
            );
          }
          if (typeof limit !== 'number' || !(limit > 0)) {
            throw new ConfigError(`${path}: "limits.${name}" should be a number above 0.`);
          }
          limits[name] = limit;
        }
        config.limits = limits;
        break;
      }
      case 'coverage':
      case 'guide':
        if (typeof setting !== 'string' || setting === '') throw problem('a path');
        config[key] = setting;
        break;
      default:
        throw new ConfigError(
          `${path} has no option "${key}". The options are ${OPTIONS.filter((o) => o !== '$schema').join(', ')}.`,
        );
    }
  }
  return config;
}

/** A config's options over the defaults, and then the command line's over both. */
export const merge = (...layers: Partial<Config>[]): Config =>
  Object.assign(
    {},
    DEFAULTS,
    ...layers.map((layer) =>
      Object.fromEntries(Object.entries(layer).filter(([, v]) => v !== undefined)),
    ),
  );
