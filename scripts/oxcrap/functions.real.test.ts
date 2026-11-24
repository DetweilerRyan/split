import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';
import { afterAll, describe, expect, it } from 'vitest';
import { findAllows } from './allow.ts';
import {
  children,
  COUNT_ALL,
  COUNT_SEPARATELY,
  type Counting,
  isNode,
  type AstNode,
} from './complexity.ts';
import { parse } from './functions.ts';

// Reformatting checks on this repository's own code: changing only a file's layout must change no
// function's complexity, and no @crap-allow comment's match. Real code reaches syntax that
// hand-written examples don't, such as JSX, TSX types and multi-byte text, so this catches
// position and comment-handling bugs the unit tests can't. The files are read from the repository
// by path, as data, not imported.
const root = fileURLToPath(new URL('../..', import.meta.url));
const oxfmt = join(root, 'node_modules/.bin/oxfmt');
const scratch = mkdtempSync(join(tmpdir(), 'oxcrap-reformat-'));

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** The code files oxCrap scores in this repository, as git sees them. */
function sourceFiles() {
  const listed = spawnSync(
    'git',
    [
      'ls-files',
      '--',
      ':(glob)src/**/*.ts',
      ':(glob)src/**/*.tsx',
      ':(glob)app/**/*.ts',
      ':(glob)app/**/*.tsx',
    ],
    {
      cwd: root,
      encoding: 'utf8',
    },
  );
  return listed.stdout
    .split('\n')
    .filter((file) => file && !/\.test\.tsx?$/.test(file))
    .sort();
}

/**
 * What a reformatting mustn't change: each function's complexity, in source order, and which of
 * them a @crap-allow comment matches. Not their names: a name comes from source text, such as
 * `seed.items.forEach callback`, so a reflow can change it, and it only labels a finding.
 */
function shape(file: string, source: string, counting: Counting) {
  const parsed = parse(file, source, counting);
  const allows = findAllows(file, source, parsed);
  return {
    complexities: parsed.functions.map((fn) => fn.complexity),
    allowed: parsed.functions.flatMap((fn, index) => (allows.allowed.has(fn) ? [index] : [])),
    problems: allows.problems.map((problem) => problem.message),
  };
}

/** The ranges of nodes whose text a new line would change the meaning of: JSX and template literals. */
function protectedRanges(file: string, source: string) {
  const ranges: [number, number][] = [];
  function visit(node: AstNode) {
    if (/^JSX(Element|Fragment)$/.test(node.type) || node.type === 'TemplateLiteral') {
      ranges.push([node.start, node.end]);
      return;
    }
    for (const child of children(node)) visit(child);
  }
  const program = parseSync(file, source).program as unknown;
  if (isNode(program)) visit(program);
  return ranges;
}

/** Inserts `text` as a line of its own before every line that starts outside JSX and templates. */
function insertLines(file: string, source: string, text: string) {
  const ranges = protectedRanges(file, source);
  function inside(offset: number) {
    return ranges.some(([start, end]) => offset > start && offset < end);
  }
  let offset = 0;
  return source
    .split('\n')
    .map((line) => {
      const start = offset;
      offset += line.length + 1;
      return inside(start) ? line : `${text}\n${line}`;
    })
    .join('\n');
}

/** Formats `source` with oxfmt under settings far from the repository's, so it reflows. */
function reformat(file: string, source: string) {
  const config = join(scratch, 'oxfmt.json');
  writeFileSync(
    config,
    JSON.stringify({ printWidth: 40, useTabs: true, singleQuote: false, semi: false }),
  );
  const result = spawnSync(oxfmt, ['-c', config, `--stdin-filepath=${file}`], {
    input: source,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`oxfmt failed on ${file}: ${result.stderr}`);
  return result.stdout;
}

const transforms: [string, (file: string, source: string) => string][] = [
  ['a blank line before every line', (file, source) => insertLines(file, source, '')],
  [
    'an unrelated comment before every line',
    (file, source) => insertLines(file, source, '// unrelated'),
  ],
  ['oxfmt, at 40 columns with tabs', reformat],
];

const files = sourceFiles();

describe('reformatting this repository’s code', () => {
  it('finds the code to check', () => {
    // Files directly in src/ and app/ too, which a plain pathspec's ** would miss, and a route
    // folder whose name is a glob character class.
    expect(files).toContain('src/RoomEntry.tsx');
    expect(files).toContain('app/r/[room]/_room-view/RoomView.tsx');
    expect(files.length).toBeGreaterThan(30);
  });

  // Under the default counting, and with each function on its own, so nested functions'
  // own counts and their @crap-allow comments are checked too.
  describe.each([
    ['counting everything', COUNT_ALL],
    ['scoring each function on its own', COUNT_SEPARATELY],
  ] as const)('%s', (_, counting) => {
    describe.each(transforms)('%s', (_, transform) => {
      it.each(files)('changes nothing oxCrap sees in %s', (file) => {
        const source = readFileSync(join(root, file), 'utf8');
        const before = shape(file, source, counting);
        expect(shape(file, transform(file, source), counting)).toEqual(before);
      });
    });
  });
});
