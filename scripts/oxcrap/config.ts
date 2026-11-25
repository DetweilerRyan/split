// Reads an .oxcraprc.json config: JSON with comments and trailing commas allowed, as oxlint's and
// oxfmt's configs are, parsed by jsonc-parser and checked by ajv against configuration_schema.json
// beside this file. The schema owns which options there are and what each may hold; this file
// owns their defaults and how they combine with the command line.
import Ajv, { type ErrorObject } from 'ajv';
import { type ParseError, parse, printParseErrorCode, visit } from 'jsonc-parser';
import { COUNT_ALL, type Counting } from './complexity.ts';
import schema from './configuration_schema.json' with { type: 'json' };

export type Limits = { readonly crap: number; readonly complexity: number };
export type Config = {
  /** Globs of the files to score, from the config's folder. */
  readonly files: readonly string[];
  /** gitignore-style patterns left out of scoring. A folder that matches isn't searched at all. */
  readonly ignorePatterns: readonly string[];
  readonly limits: Limits;
  /** What counts towards complexity beyond the fixed branches. Everything, by default. */
  readonly counting: Counting;
  /** The istanbul JSON coverage report, from the config's folder. */
  readonly coverage?: string;
  /** Where to get help when there are findings: a URL, or a path from the config's folder. */
  readonly helpUrl?: string;
};
/** What a config file holds, once the schema has checked it. */
type File = Partial<Omit<Config, 'limits' | 'counting'>> & {
  readonly limits?: Partial<Limits>;
  readonly counting?: Partial<Counting>;
  readonly $schema?: string;
};

/** The names oxCrap looks for in the current directory when no config is given, in order. */
export const CONFIG_NAMES = ['.oxcraprc.json', '.oxcraprc.jsonc'] as const;

export const CODE_FILES = '**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}';

export const DEFAULTS: Config = {
  files: [CODE_FILES],
  ignorePatterns: ['node_modules/', '.*/', '*.test.*', '*.spec.*'],
  limits: { crap: 30, complexity: 10 },
  counting: COUNT_ALL,
};

/** The options a config may set, as the schema lists them, leaving out `$schema`. */
export const OPTIONS = Object.keys(schema.properties).filter((name) => name !== '$schema');

export class ConfigError extends Error {}

const validate = new Ajv({ allErrors: true }).compile<File>(schema);

/** The line and column of an offset in `text`, both from 1. */
function lineAndColumn(text: string, offset: number) {
  const before = text.slice(0, offset);
  return `${before.split('\n').length}:${before.length - before.lastIndexOf('\n')}`;
}

/** One schema error as a sentence about the option it concerns. */
function describe(error: ErrorObject, path: string) {
  const option = error.instancePath.slice(1).replaceAll('/', '.');
  if (error.keyword === 'additionalProperties') {
    // Ajv names the extra key in `additionalProperty`, which its types declare only as any.
    const name = String(error.params.additionalProperty);
    return option !== ''
      ? `${path}: "${option}" has no option "${name}".`
      : `${path} has no option "${name}". The options are ${OPTIONS.join(', ')}.`;
  }
  return option !== '' ? `${path}: "${option}" ${error.message}.` : `${path} ${error.message}.`;
}

/** The options a config file sets, checked against the schema. */
export function parseConfig(text: string, path: string): Partial<Config> {
  const errors: ParseError[] = [];
  const data: unknown = parse(text, errors, { allowTrailingComma: true });
  const [first] = errors;
  if (first !== undefined) {
    throw new ConfigError(
      `${path} isn't valid JSON at ${lineAndColumn(text, first.offset)}: ${printParseErrorCode(first.error)}.`,
    );
  }
  // jsonc-parser assigns a "__proto__" key, which sets the object's prototype instead, so the
  // schema would never see it and the key would be quietly ignored.
  let proto: number | undefined;
  visit(text, {
    onObjectProperty: (property, offset) => {
      if (property === '__proto__') proto ??= offset;
    },
  });
  if (proto !== undefined) {
    throw new ConfigError(`${path} has no option "__proto__", at ${lineAndColumn(text, proto)}.`);
  }
  if (!validate(data)) {
    // Ajv always sets `errors` when validation fails; its types allow null.
    // Stryker disable next-line ArrayDeclaration: Ajv sets `errors` whenever validate returns false, so the empty list is never read.
    const errors = validate.errors ?? [];
    throw new ConfigError(errors.map((error) => describe(error, path)).join('\n'));
  }
  const { $schema: _, limits, counting, ...rest } = data;
  return {
    ...rest,
    ...(limits !== undefined ? { limits: { ...DEFAULTS.limits, ...limits } } : {}),
    ...(counting !== undefined ? { counting: { ...DEFAULTS.counting, ...counting } } : {}),
  };
}

/** Options laid over the defaults by `merge`. An option set to `undefined` is left unset. */
type Layer = { readonly [Option in keyof Config]?: Config[Option] | undefined };

/** A config's options over the defaults, and then the command line's over both. */
export function merge(...layers: readonly Layer[]): Config {
  return layers.reduce<Config>(
    (config, layer) => ({
      ...config,
      ...Object.fromEntries(Object.entries(layer).filter(([, value]) => value !== undefined)),
    }),
    DEFAULTS,
  );
}
