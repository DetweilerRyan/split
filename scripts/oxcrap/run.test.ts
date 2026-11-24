import { posix } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CODE_FILES } from './config.ts';
import { type Host, isUrl, outcome, outside, resolveImport, run, USAGE } from './run.ts';

// run.ts over files in memory. The feature contract in features/ checks the real program end to
// end; these check the same rules from the inside, so they count towards oxCrap's own coverage.

const CWD = '/repo';

/** A function with `complexity - 1` if statements. */
function branchy(name: string, complexity: number) {
  return `export function ${name}(n: number) {\n${Array.from({ length: complexity - 1 }, (_, i) => `  if (n === ${i}) return ${i};`).join('\n')}\n  return -1;\n}\n`;
}

/** A coverage report covering `files` (absolute paths), all or none of each. */
function report(files: Readonly<Record<string, string>>, covered: readonly string[] = []) {
  const entries = Object.entries(files).map(([path, source]) => {
    const statementMap: Record<string, unknown> = {};
    const s: Record<string, number> = {};
    source.split('\n').forEach((line, i) => {
      if (!line.trim()) return;
      statementMap[i] = {
        start: { line: i + 1, column: 0 },
        end: { line: i + 1, column: line.length },
      };
      s[i] = covered.includes(path) ? 1 : 0;
    });
    return [path, { statementMap, s, fnMap: {}, f: {} }];
  });
  return JSON.stringify(Object.fromEntries(entries));
}

/**
 * A host over `files`, keyed by absolute path. Each file's modified time is 1 unless `times` says
 * otherwise. Folders are the parents of the files, and `findFiles` returns every code file under
 * `root` that isn't a test, plus `named`.
 */
function host(
  files: Readonly<Record<string, string>>,
  times: Readonly<Record<string, number>> = {},
): Host {
  const folders = new Set<string>();
  for (const path of Object.keys(files)) {
    for (let dir = posix.dirname(path); dir !== '/'; dir = posix.dirname(dir)) folders.add(dir);
  }
  return {
    cwd: CWD,
    caseInsensitive: false,
    exists: (path) => path in files || folders.has(path),
    isDirectory: (path) => folders.has(path),
    read: (path) => {
      const text = files[path];
      if (text === undefined) throw new Error(`no file ${path}`);
      return text;
    },
    modified: (path) => times[path] ?? 1,
    realpath: (path) => path,
    findFiles: (root, globs, _ignore, named) => {
      const found = Object.keys(files)
        .filter((path) => path.startsWith(`${root}/`))
        .map((path) => posix.relative(root, path))
        .filter((path) => globs.some((glob) => posix.matchesGlob(path, glob)));
      const matched = [...new Set([...found, ...named])];
      return { matched, scored: matched.filter((path) => !path.includes('.test.')) };
    },
  };
}

/** The usual project: one function over the limits, a report covering none of it, newer. */
function project(extra: Readonly<Record<string, string>> = {}, covered: readonly string[] = []) {
  const code = { '/repo/src/grade.ts': branchy('grade', 12), ...extra };
  const codeOnly = Object.fromEntries(Object.entries(code).filter(([p]) => p.endsWith('.ts')));
  return {
    files: { ...code, '/repo/coverage.json': report(codeOnly, covered) },
    times: { '/repo/coverage.json': 2 },
  };
}

function oxcrap(
  args: readonly string[],
  files: Readonly<Record<string, string>>,
  times?: Readonly<Record<string, number>>,
) {
  return run(args, host(files, times));
}

describe('run', () => {
  it('reports a function over the limits, with the comment that would allow it, and exits 1', () => {
    const { files, times } = project();
    expect(oxcrap(['--coverage', 'coverage.json', 'src'], files, times)).toEqual({
      status: 1,
      stdout: [],
      stderr: [
        'CRAP findings:\n- src/grade.ts:1 grade: CRAP 156, complexity 12, coverage 0%. Over the limits (CRAP 30, complexity 10). To leave it, add `// @crap-allow CRAP 156, complexity 12. <reason>` directly above it.',
      ],
    });
  });

  it('passes a function the tests run all of', () => {
    const { files, times } = project({ '/repo/src/grade.ts': branchy('grade', 6) }, [
      '/repo/src/grade.ts',
    ]);
    expect(oxcrap(['--coverage', 'coverage.json', 'src'], files, times)).toEqual({
      status: 0,
      stdout: ['No CRAP findings.'],
      stderr: [],
    });
  });

  it('reads the config in the current folder, and prints its help path from there', () => {
    const { files, times } = project({
      '/repo/.oxcraprc.json': '{ "coverage": "coverage.json", "helpUrl": "HELP.md" }',
      '/repo/HELP.md': '# Help',
    });
    expect(oxcrap([], files, times).stderr.at(-1)).toBe('\nGet help: HELP.md');
  });

  it('reads a config -c names from its own folder', () => {
    const files = {
      '/repo/web/src/grade.ts': branchy('grade', 12),
      '/repo/web/crap.json': '{ "coverage": "../coverage.json" }',
    };
    const all = {
      ...files,
      '/repo/coverage.json': report({ '/repo/web/src/grade.ts': files['/repo/web/src/grade.ts'] }),
    };
    expect(oxcrap(['-c', 'web/crap.json'], all, { '/repo/coverage.json': 2 }).stderr[0]).toContain(
      '- web/src/grade.ts:1 grade: CRAP 156',
    );
  });

  it('prints a help URL as it is, and refuses a help path that doesn’t exist', () => {
    const { files, times } = project();
    const args = ['--coverage', 'coverage.json', 'src'];
    expect(
      oxcrap([...args, '--help-url', 'https://example.com/crap'], files, times).stderr.at(-1),
    ).toBe('\nGet help: https://example.com/crap');
    expect(oxcrap([...args, '--help-url', 'NOPE.md'], files, times).stderr).toEqual([
      'No help file at NOPE.md, which --help-url names.',
    ]);
  });

  it.each([
    [['-c', 'nope.json'], {}, 'No config file at nope.json.'],
    [['-c', 'src'], {}, 'src is a folder, not a config file.'],
    [['--coverage', 'coverage.json', 'lib'], {}, 'No file or folder at lib.'],
    [
      ['src'],
      {},
      `${USAGE}\nGive the coverage report with --coverage, or as "coverage" in .oxcraprc.json.`,
    ],
    [
      [],
      { '/repo/.oxcraprc.json': '{ "coverage": "coverage.json", "files": ["../x/*.ts"] }' },
      '.oxcraprc.json: "files" can\'t reach outside the config\'s folder, as "../x/*.ts" does. Move the config up to a folder that holds the files.',
    ],
    [
      [],
      { '/repo/.oxcraprc.json': '{ "coverage": "coverage.json", "helpUrl": "docs/help.md" }' },
      'No help file at docs/help.md, which "helpUrl" in .oxcraprc.json names.',
    ],
  ] as const)('stops with %j: %s', (args, extra, message) => {
    const { files, times } = project(extra);
    expect(oxcrap([...args], files, times)).toEqual({ status: 1, stdout: [], stderr: [message] });
  });

  it('refuses a path outside the folder it scores', () => {
    const { files, times } = project({ '/repo/web/keep.ts': 'export {};\n' });
    const scored = run(['--coverage', '../coverage.json', '../src'], {
      ...host(files, times),
      cwd: '/repo/web',
    });
    expect(scored.stderr).toEqual(['../src is outside ., the folder oxCrap scores.']);
  });

  it('refuses a folder with a glob character in its name', () => {
    const { files, times } = project({ '/repo/src/[old]/a.ts': 'export {};\n' });
    expect(oxcrap(['--coverage', 'coverage.json', 'src/[old]'], files, times).stderr).toEqual([
      'src/[old] has a glob character in its name; list it in "files" instead.',
    ]);
  });

  it('scores only a single file named on the command line', () => {
    const { files, times } = project({ '/repo/src/rank.ts': branchy('rank', 12) });
    const scored = oxcrap(['--coverage', 'coverage.json', 'src/grade.ts'], files, times);
    const listed = scored.stderr[0]?.split('\n').slice(1);
    expect(listed).toHaveLength(1);
    expect(listed?.[0]).toMatch(/^- src\/grade\.ts:1 grade: /);
  });

  it('scores only the code files in a folder named on the command line', () => {
    const { files, times } = project({
      '/repo/lib/rank.ts': branchy('rank', 12),
      '/repo/src/grade.test.ts': branchy('check', 12),
      '/repo/src/notes.md': '# Notes',
    });
    const scored = oxcrap(['--coverage', 'coverage.json', 'src'], files, times);
    const listed = scored.stderr[0]?.split('\n').slice(1);
    expect(listed).toHaveLength(1);
    expect(listed?.[0]).toMatch(/^- src\/grade\.ts:1 grade: /);
  });

  it('refuses a missing report, one older than the code, and one covering none of it', () => {
    const { files, times } = project();
    const args = ['--coverage', 'coverage.json', 'src'];
    const { '/repo/coverage.json': _, ...noReport } = files;
    expect(oxcrap(args, noReport).stderr[0]).toBe(
      'No coverage report at coverage.json. Run the tests with coverage first; a run whose tests fail may write none.',
    );
    expect(
      oxcrap(
        args,
        { ...files, '/repo/src/rank.ts': 'export {};\n' },
        { ...times, '/repo/src/grade.ts': 3, '/repo/src/rank.ts': 3 },
      ).stderr[0],
    ).toBe(
      'The coverage report at coverage.json is older than src/grade.ts and 1 more. Run the tests again, so it covers the code as it is.',
    );
    expect(oxcrap(args, { ...files, '/repo/coverage.json': '{}' }, times).stderr[0]).toBe(
      'The coverage report at coverage.json covers none of the 1 files being scored. Is it the report for this code, written from this folder?',
    );
  });

  it('counts a lookup table a file imports from a relative path, without its extension', () => {
    const kinds = `export const KINDS = new Set([${Array.from({ length: 11 }, (_, i) => `'k${i}'`).join(', ')}]);\n`;
    const grade =
      "import { KINDS } from './kinds';\nexport function grade(k: string) {\n  return KINDS.has(k);\n}\n";
    const code = { '/repo/src/kinds.ts': kinds, '/repo/src/grade.ts': grade };
    const files = { ...code, '/repo/coverage.json': report(code) };
    const scored = oxcrap(['--coverage', 'coverage.json', 'src'], files, {
      '/repo/coverage.json': 2,
    });
    expect(scored.stderr[0]).toContain(
      '- src/grade.ts:2 grade: CRAP 132, complexity 11, coverage 0%',
    );
  });

  it('refuses files that match nothing', () => {
    const files = {
      '/repo/.oxcraprc.json': '{ "coverage": "coverage.json" }',
      '/repo/coverage.json': '{}',
    };
    expect(oxcrap([], files).stderr).toEqual([
      'No files to score: nothing matches "files" in .oxcraprc.json that "ignorePatterns" leaves in.',
    ]);
  });

  it('matches coverage without case when the host says paths are compared so', () => {
    const { files, times } = project({}, ['/repo/src/grade.ts']);
    const upper = {
      ...files,
      '/repo/coverage.json': files['/repo/coverage.json'].replace(
        '/repo/src/grade.ts',
        '/REPO/src/Grade.ts',
      ),
    };
    const scored = run(['--coverage', 'coverage.json', 'src'], {
      ...host(upper, times),
      caseInsensitive: true,
    });
    expect(scored.stderr[0]).toContain('coverage 100%');
  });

  it('honours a @crap-allow comment, and reports a problem with one', () => {
    const allowed = `// @crap-allow CRAP 156, complexity 12. Kept as it is.\n${branchy('grade', 12)}`;
    const { files, times } = project({ '/repo/src/grade.ts': allowed });
    const args = ['--coverage', 'coverage.json', 'src'];
    expect(oxcrap(args, files, times).status).toBe(0);
    const noReason = allowed.replace(' Kept as it is.', '');
    expect(oxcrap(args, { ...files, '/repo/src/grade.ts': noReason }, times).stderr).toEqual([
      'CRAP findings:\n- src/grade.ts:1 The @crap-allow comment for grade gives no reason.',
    ]);
  });

  it('matches each file to its own coverage', () => {
    const { files, times } = project({ '/repo/src/rank.ts': branchy('rank', 6) }, [
      '/repo/src/rank.ts',
    ]);
    expect(oxcrap(['--coverage', 'coverage.json', 'src'], files, times).stderr).toEqual([
      expect.stringMatching(/^CRAP findings:\n- src\/grade\.ts:1 grade: CRAP 156, [^\n]*$/),
    ]);
  });

  it('compares paths without case letter by letter, so ß isn’t SS', () => {
    const { files, times } = project({}, ['/repo/src/grade.ts']);
    const strasse = {
      '/repo/src/straße.ts': files['/repo/src/grade.ts'],
      '/repo/coverage.json': files['/repo/coverage.json'].replace(
        '/repo/src/grade.ts',
        '/repo/src/STRASSE.ts',
      ),
    };
    const scored = run(['--coverage', 'coverage.json', 'src'], {
      ...host(strasse, times),
      caseInsensitive: true,
    });
    expect(scored.stderr).toEqual([
      'The coverage report at coverage.json covers none of the 1 files being scored. Is it the report for this code, written from this folder?',
    ]);
  });

  it('asks the host for a folder’s code files, and passes a file named outright apart', () => {
    const { files, times } = project();
    const findFiles = vi.fn(host(files, times).findFiles);
    run(['--coverage', 'coverage.json', 'src'], { ...host(files, times), findFiles });
    run(['--coverage', 'coverage.json', 'src/grade.ts'], { ...host(files, times), findFiles });
    expect(findFiles.mock.calls).toEqual([
      ['/repo', [`src/${CODE_FILES}`], expect.any(Array), []],
      ['/repo', [], expect.any(Array), ['src/grade.ts']],
    ]);
  });

  it('names the one file a report is older than', () => {
    const { files, times } = project();
    expect(
      oxcrap(['--coverage', 'coverage.json', 'src'], files, { ...times, '/repo/src/grade.ts': 3 })
        .stderr,
    ).toEqual([
      'The coverage report at coverage.json is older than src/grade.ts. Run the tests again, so it covers the code as it is.',
    ]);
  });

  it('refuses paths given on the command line that hold nothing to score', () => {
    const { files, times } = project({ '/repo/lib/grade.test.ts': branchy('check', 2) });
    expect(oxcrap(['--coverage', 'coverage.json', 'lib'], files, times).stderr).toEqual([
      'No files to score: nothing matches the paths given that "ignorePatterns" leaves in.',
    ]);
  });

  it('scores a file whose relative import names no file', () => {
    const grade = `import { KINDS } from './missing';\n${branchy('grade', 2)}`;
    const { files, times } = project({ '/repo/src/grade.ts': grade });
    expect(oxcrap(['--coverage', 'coverage.json', 'src'], files, times).status).toBe(0);
  });

  it('reads a module once however many scored files import it', () => {
    function importer(name: string) {
      return `import { KINDS } from '../lib/kinds';\nexport function ${name}(k: string) {\n  return KINDS.has(k);\n}\n`;
    }
    const { files, times } = project({
      '/repo/lib/kinds.ts': "export const KINDS = new Set(['a']);\n",
      '/repo/src/grade.ts': importer('grade'),
      '/repo/src/rank.ts': importer('rank'),
    });
    const read = vi.fn(host(files, times).read);
    run(['--coverage', 'coverage.json', 'src'], { ...host(files, times), read });
    expect(read.mock.calls.filter(([path]) => path === '/repo/lib/kinds.ts')).toHaveLength(1);
  });

  it('reports a message for anything thrown that isn’t an Error', () => {
    const broken: Host = {
      ...host({}),
      exists: () => {
        throw 'disk gone';
      },
    };
    expect(run([], broken)).toEqual({ status: 1, stdout: [], stderr: ['disk gone'] });
  });
});

describe('resolveImport', () => {
  const files = host({
    '/repo/src/kinds.ts': '',
    '/repo/src/lib/index.ts': '',
    '/repo/src/both.ts': '',
    '/repo/src/both/index.ts': '',
    '/repo/src/view.tsx': '',
    '/repo/src/kinds.json.ts': '',
    '/repo/src/shape.ts': '',
    '/repo/src/shape.mts': '',
  });

  it.each([
    ['./kinds', '/repo/src/kinds.ts'],
    ['./kinds.ts', '/repo/src/kinds.ts'],
    ['./kinds.js', '/repo/src/kinds.ts'],
    ['./view.jsx', '/repo/src/view.tsx'],
    ['./lib', '/repo/src/lib/index.ts'],
    ['./both', '/repo/src/both.ts'],
    ['./kinds.json.js', '/repo/src/kinds.json.ts'],
    ['./shape.mjs', '/repo/src/shape.mts'],
    ['../src/kinds', '/repo/src/kinds.ts'],
    ['./missing', undefined],
  ])('%s from src/grade.ts is %s', (from, expected) => {
    expect(resolveImport(files, '/repo/src/grade.ts', from)).toBe(expected);
  });
});

describe('outside', () => {
  it.each([
    ['..', true],
    ['../src', true],
    ['src/../../x', true],
    ['{src,../x}/*.ts', true],
    ['/etc', true],
    ['C:/x', true],
    ['src', false],
    ['..x/a.ts', false],
    ['a..b', false],
    ['src/c:x', false],
  ])('%s → %s', (path, expected) => {
    expect(outside(path)).toBe(expected);
  });
});

describe('isUrl and outcome', () => {
  it('tells a URL from a path', () => {
    expect(isUrl('https://example.com')).toBe(true);
    expect(isUrl('docs/help.md')).toBe(false);
    expect(isUrl('docs/https://example.com')).toBe(false);
  });

  it('prints the help line only with findings and a help value', () => {
    const finding = { file: 'a.ts', line: 1, message: 'm' };
    expect(outcome([finding], undefined).stderr).toEqual(['CRAP findings:\n- a.ts:1 m']);
    expect(outcome([finding, { ...finding, line: 2 }], undefined).stderr).toEqual([
      'CRAP findings:\n- a.ts:1 m\n- a.ts:2 m',
    ]);
    expect(outcome([], 'HELP.md')).toEqual({
      status: 0,
      stdout: ['No CRAP findings.'],
      stderr: [],
    });
  });
});
