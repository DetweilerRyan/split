import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULTS } from './config.ts';

// The script's contract, end to end: it runs as a program on a plain folder, not a git repository,
// given a coverage report. The rules themselves are tested beside each module.

const script = fileURLToPath(new URL('./oxcrap.ts', import.meta.url));
const directories: string[] = [];

/** A function with `branches` if statements, so its complexity is branches + 1. */
function branchy(name: string, branches: number) {
  const ifs = Array.from({ length: branches }, (_, i) => `  if (n === ${i}) return ${i};`);
  return `export function ${name}(n: number) {\n${ifs.join('\n')}\n  return -1;\n}\n`;
}

function write(cwd: string, files: Record<string, string>) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), content);
  }
}

/** A plain folder holding `files`: no git, no package.json. */
function project(files: Record<string, string>) {
  const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-oxcrap-test-'));
  directories.push(cwd);
  write(cwd, files);
  return cwd;
}

/**
 * Writes coverage.json as a test run would: one statement per non-blank line of each listed file,
 * run when it's in `covered`. Written last, so it's newer than the code.
 */
function coverage(cwd: string, files: string[], covered: string[] = []) {
  const report: Record<string, unknown> = {};
  for (const file of files) {
    const statementMap: Record<string, unknown> = {};
    const s: Record<string, number> = {};
    readFileSync(join(cwd, file), 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (!line.trim()) return;
        statementMap[index] = {
          start: { line: index + 1, column: 0 },
          end: { line: index + 1, column: line.length },
        };
        s[index] = covered.includes(file) ? 1 : 0;
      });
    report[resolve(cwd, file)] = { statementMap, s, fnMap: {}, f: {}, branchMap: {}, b: {} };
  }
  writeFileSync(join(cwd, 'coverage.json'), JSON.stringify(report));
}

function oxcrap(cwd: string, args = ['--coverage', 'coverage.json', 'src']) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const allow = (crap: number, complexity: number) =>
  `// @crap-allow CRAP ${crap}, complexity ${complexity}. One branch per row of the rate table.\n`;

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe('README.md', () => {
  // The README lists the config's defaults for people; config.ts owns them, and config.test.ts
  // checks the schema. This keeps the README from drifting.
  it('shows the defaults the code uses', () => {
    const readme = readFileSync(fileURLToPath(new URL('./README.md', import.meta.url)), 'utf8');
    const json = (value: unknown) =>
      JSON.stringify(value).replaceAll(',', ', ').replaceAll(':', ': ');
    expect(readme).toContain(`\`${JSON.stringify(DEFAULTS.files)}\``);
    expect(readme).toContain(
      `\`${JSON.stringify(DEFAULTS.ignorePatterns).replaceAll(',', ', ')}\``,
    );
    expect(readme).toContain(`\`{ ${json(DEFAULTS.limits).slice(1, -1)} }\``);
  });
});

describe('oxcrap', () => {
  it('fails a function over the limits, says what comment would allow it, and where to get help', () => {
    const cwd = project({ 'src/grade.ts': branchy('grade', 11), 'HELP.md': '# Help\n' });
    coverage(cwd, ['src/grade.ts']);

    const result = oxcrap(cwd, ['--coverage', 'coverage.json', '--help-url', 'HELP.md', 'src']);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      '- src/grade.ts:1 grade: CRAP 156, complexity 12, coverage 0%. Over the limits (CRAP 30, complexity 10). To leave it, add `// @crap-allow CRAP 156, complexity 12. <reason>` directly above it.',
    );
    expect(result.output).toContain('Get help: HELP.md');
  });

  it('passes a function its tests run all of', () => {
    const cwd = project({ 'src/grade.ts': branchy('grade', 5) });
    coverage(cwd, ['src/grade.ts'], ['src/grade.ts']);

    const result = oxcrap(cwd);

    expect(result.output).toContain('No CRAP findings.');
    expect(result.status).toBe(0);
  });

  it('passes a function whose @crap-allow comment gives its numbers, and fails one that no longer matches', () => {
    const cwd = project({ 'src/grade.ts': allow(156, 12) + branchy('grade', 11) });
    coverage(cwd, ['src/grade.ts']);
    expect(oxcrap(cwd).status).toBe(0);

    write(cwd, { 'src/grade.ts': allow(156, 12) + branchy('grade', 12) });
    coverage(cwd, ['src/grade.ts']);
    const result = oxcrap(cwd);
    expect(result.status).toBe(1);
    expect(result.output).toContain(
      '- src/grade.ts:1 grade: CRAP 182, complexity 13, coverage 0%, but its @crap-allow comment says CRAP 156, complexity 12. Update the comment to `// @crap-allow CRAP 182, complexity 13.`, and check its reason still holds.',
    );
  });

  it('scores every file under a path, but not tests, node_modules or dot-folders', () => {
    const cwd = project({
      'src/deep/rank.ts': branchy('rank', 11),
      'src/rank.test.ts': branchy('rankTest', 11),
      'src/node_modules/lib/index.ts': branchy('lib', 11),
      'src/.cache/built.ts': branchy('built', 11),
    });
    coverage(cwd, ['src/deep/rank.ts']);

    const result = oxcrap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain('- src/deep/rank.ts:1 rank: CRAP 156');
    expect(result.output).not.toMatch(/rankTest|lib:|built:/);
  });

  it('names files from the directory it runs in', () => {
    const cwd = project({ 'src/grade.ts': branchy('grade', 11) });
    coverage(cwd, ['src/grade.ts']);

    const result = oxcrap(join(cwd, 'src'), ['--coverage', '../coverage.json', '.']);

    expect(result.status).toBe(1);
    expect(result.output).toContain('- grade.ts:1 grade: CRAP 156');
  });

  it('refuses to score without a coverage report', () => {
    const cwd = project({ 'src/keep.ts': 'export const keep = 1;\n' });

    const result = oxcrap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      'No coverage report at coverage.json. Run the tests with coverage first; a run whose tests fail may write none.',
    );
  });

  it('refuses a coverage report older than a test file, though tests aren’t scored', () => {
    const cwd = project({
      'src/keep.ts': 'export const keep = 1;\n',
      'src/keep.test.ts': 'export {};\n',
    });
    coverage(cwd, ['src/keep.ts']);
    const later = new Date(Date.now() + 60_000);
    utimesSync(join(cwd, 'src/keep.test.ts'), later, later);

    expect(oxcrap(cwd).output).toContain(
      'The coverage report at coverage.json is older than src/keep.test.ts.',
    );
  });

  it('scores a single file named on the command line', () => {
    const cwd = project({
      'src/grade.ts': branchy('grade', 11),
      'src/rank.ts': branchy('rank', 11),
    });
    coverage(cwd, ['src/grade.ts', 'src/rank.ts']);

    const result = oxcrap(cwd, ['--coverage', 'coverage.json', 'src/grade.ts']);

    expect(result.output).toContain('- src/grade.ts:1 grade: CRAP 156');
    expect(result.output).not.toContain('rank');
  });

  it('refuses a coverage report older than the code', () => {
    const cwd = project({ 'src/keep.ts': 'export const keep = 1;\n' });
    coverage(cwd, ['src/keep.ts']);
    const later = new Date(Date.now() + 60_000);
    utimesSync(join(cwd, 'src/keep.ts'), later, later);

    const result = oxcrap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      'The coverage report at coverage.json is older than src/keep.ts. Run the tests again, so it covers the code as it is.',
    );
  });

  it('says what’s wrong when a path is missing, or no coverage report is given', () => {
    const cwd = project({ 'src/keep.ts': 'export const keep = 1;\n' });
    coverage(cwd, ['src/keep.ts']);

    expect(oxcrap(cwd, ['--coverage', 'coverage.json', 'lib']).output).toContain(
      'No file or folder at lib.',
    );
    expect(oxcrap(cwd, ['src']).output).toContain(
      'Usage: node scripts/oxcrap/oxcrap.ts [-c <config>] [--coverage <report>] [--help-url <url>] [<path>...]\nGive the coverage report with --coverage, or as "coverage" in .oxcraprc.json.',
    );
  });

  it('refuses a report that covers none of the files being scored', () => {
    const cwd = project({ 'src/grade.ts': branchy('grade', 11), 'lib/other.ts': 'export {};\n' });
    coverage(cwd, ['lib/other.ts']);

    expect(oxcrap(cwd).output).toContain(
      'The coverage report at coverage.json covers none of the 1 files being scored. Is it the report for this code, written from this folder?',
    );
  });

  it('matches coverage to files through a symlink, as the test run saw them', () => {
    const cwd = project({
      '.oxcraprc.json': JSON.stringify({ coverage: 'coverage.json' }),
      'src/grade.ts': branchy('grade', 5),
    });
    coverage(cwd, ['src/grade.ts'], ['src/grade.ts']);
    const link = join(mkdtempSync(join(tmpdir(), 'splitsmart-oxcrap-link-')), 'project');
    directories.push(dirname(link));
    symlinkSync(cwd, link, 'dir');

    const result = oxcrap(dirname(link), ['-c', 'project/.oxcraprc.json']);

    expect(result.output).toContain('No CRAP findings.');
    expect(result.status).toBe(0);
  });

  it('refuses a report missing a part the scoring reads', () => {
    const cwd = project({ 'src/keep.ts': 'export const keep = 1;\n' });
    writeFileSync(
      join(cwd, 'coverage.json'),
      JSON.stringify({ [resolve(cwd, 'src/keep.ts')]: { statementMap: {}, s: {} } }),
    );

    expect(oxcrap(cwd).output).toContain(
      "coverage.json isn't an istanbul JSON coverage report, such as coverage-final.json.",
    );
  });

  describe('with a config file', () => {
    const rc = (options: object) => JSON.stringify(options, null, 2);

    it('reads .oxcraprc.json from the current directory: its files, coverage and helpUrl', () => {
      const cwd = project({
        '.oxcraprc.json': `{
  // Comments are allowed, as in oxlint's and oxfmt's configs.
  "files": ["lib/**/*.ts"],
  "coverage": "coverage.json",
  "helpUrl": "HELP.md",
}
`,
        'lib/grade.ts': branchy('grade', 11),
        'src/ignored.ts': branchy('ignored', 11),
        'HELP.md': '# Help\n',
      });
      coverage(cwd, ['lib/grade.ts']);

      const result = oxcrap(cwd, []);

      expect(result.status).toBe(1);
      expect(result.output).toContain('- lib/grade.ts:1 grade: CRAP 156');
      expect(result.output).not.toContain('ignored');
      expect(result.output).toContain('Get help: HELP.md');
    });

    it('reads a config -c names, with its paths from the config’s folder', () => {
      const cwd = project({
        'web/crap.json': rc({ files: ['src/**/*.ts'], coverage: '../coverage.json' }),
        'web/src/grade.ts': branchy('grade', 11),
        'src/elsewhere.ts': branchy('elsewhere', 11),
      });
      coverage(cwd, ['web/src/grade.ts']);

      const result = oxcrap(cwd, ['--config', 'web/crap.json']);

      expect(result.status).toBe(1);
      expect(result.output).toContain('- web/src/grade.ts:1 grade: CRAP 156');
      expect(result.output).not.toContain('elsewhere');
      expect(oxcrap(join(cwd, 'web'), ['-c', 'crap.json']).output).toContain(
        '- src/grade.ts:1 grade: CRAP 156',
      );
    });

    it('refuses ".." anywhere in a files glob, and a folder given as the config', () => {
      const cwd = project({ 'src/keep.ts': 'export const keep = 1;\n' });
      coverage(cwd, ['src/keep.ts']);

      for (const glob of ['src/../../other/*.ts', '{src,../other}/*.ts']) {
        write(cwd, { '.oxcraprc.json': rc({ coverage: 'coverage.json', files: [glob] }) });
        expect(oxcrap(cwd, []).output).toContain(
          `can't reach outside the config's folder, as "${glob}" does.`,
        );
      }
      expect(oxcrap(cwd, ['-c', 'src']).output).toContain('src is a folder, not a config file.');
    });

    it('doesn’t let a ! in ignorePatterns bring back what the .gitignore lists', () => {
      const cwd = project({
        '.gitignore': '*.gen.ts\n',
        '.oxcraprc.json': rc({ coverage: 'coverage.json', ignorePatterns: ['!api.gen.ts'] }),
        'src/keep.ts': 'export const keep = 1;\n',
        'src/api.gen.ts': branchy('api', 11),
      });
      coverage(cwd, ['src/keep.ts']);

      expect(oxcrap(cwd, []).output).toContain('No CRAP findings.');
    });

    it('refuses files outside the config’s folder', () => {
      const cwd = project({
        'web/crap.json': rc({ files: ['../src/**/*.ts'], coverage: '../coverage.json' }),
        'src/grade.ts': branchy('grade', 11),
      });
      coverage(cwd, ['src/grade.ts']);

      expect(oxcrap(cwd, ['-c', 'web/crap.json']).output).toContain(
        `web/crap.json: "files" can't reach outside the config's folder, as "../src/**/*.ts" does.`,
      );
      expect(
        oxcrap(join(cwd, 'web'), ['--coverage', '../coverage.json', '../src']).output,
      ).toContain('../src is outside ., the folder oxCrap scores.');
    });

    it('leaves out what the .gitignore in its folder lists, as oxlint does', () => {
      const cwd = project({
        '.gitignore': 'generated/\n*.gen.ts\n',
        '.oxcraprc.json': rc({ coverage: 'coverage.json' }),
        'src/grade.ts': branchy('grade', 11),
        'src/generated/types.ts': branchy('types', 11),
        'src/api.gen.ts': branchy('api', 11),
      });
      coverage(cwd, ['src/grade.ts']);

      const result = oxcrap(cwd, []);

      expect(result.output).toContain('- src/grade.ts:1 grade: CRAP 156');
      expect(result.output).not.toMatch(/types:|api:/);
    });

    it('doesn’t count a gitignored file written after the tests ran against the report', () => {
      // A file pattern, not a folder: a folder the .gitignore lists isn't searched at all.
      const cwd = project({
        '.gitignore': '*.gen.js\n',
        '.oxcraprc.json': rc({ coverage: 'coverage.json' }),
        'src/keep.ts': 'export const keep = 1;\n',
        'src/api.gen.js': 'export const api = 1;\n',
      });
      coverage(cwd, ['src/keep.ts']);
      const later = new Date(Date.now() + 60_000);
      utimesSync(join(cwd, 'src/api.gen.js'), later, later);

      const result = oxcrap(cwd, []);

      expect(result.output).toContain('No CRAP findings.');
      expect(result.status).toBe(0);
    });

    it('reads the .gitignore beside the config, not in the current directory', () => {
      const cwd = project({
        'web/.gitignore': 'legacy/\n',
        'web/crap.json': rc({ files: ['src/**/*.ts'], coverage: '../coverage.json' }),
        'web/src/legacy/old.ts': branchy('old', 11),
        'web/src/grade.ts': 'export const grade = 1;\n',
      });
      coverage(cwd, ['web/src/grade.ts']);

      expect(oxcrap(cwd, ['-c', 'web/crap.json']).output).toContain('No CRAP findings.');
    });

    it('checks helpUrl’s file exists on every run, even with no findings', () => {
      const cwd = project({
        '.oxcraprc.json': rc({ coverage: 'coverage.json', helpUrl: 'docs/help.md' }),
        'src/keep.ts': 'export const keep = 1;\n',
      });
      coverage(cwd, ['src/keep.ts']);

      const result = oxcrap(cwd, []);

      expect(result.status).toBe(1);
      expect(result.output).toContain(
        'No help file at docs/help.md, which "helpUrl" in .oxcraprc.json names.',
      );
    });

    it('prints a helpUrl that is a URL as it is, without checking it', () => {
      const cwd = project({
        '.oxcraprc.json': rc({ coverage: 'coverage.json', helpUrl: 'https://example.com/crap' }),
        'src/grade.ts': branchy('grade', 11),
      });
      coverage(cwd, ['src/grade.ts']);

      expect(oxcrap(cwd, []).output).toContain('Get help: https://example.com/crap');
    });

    it('reads helpUrl’s path from the config’s folder, and prints it from the current directory', () => {
      const cwd = project({
        'web/crap.json': rc({
          files: ['src/**/*.ts'],
          coverage: '../coverage.json',
          helpUrl: 'docs/help.md',
        }),
        'web/docs/help.md': '# Help\n',
        'web/src/grade.ts': branchy('grade', 11),
      });
      coverage(cwd, ['web/src/grade.ts']);

      expect(oxcrap(cwd, ['-c', 'web/crap.json']).output).toContain('Get help: web/docs/help.md');
    });

    it('reads ignorePatterns as gitignore does: a folder at any depth, and ! to bring a file back', () => {
      const cwd = project({
        '.oxcraprc.json': rc({
          coverage: 'coverage.json',
          ignorePatterns: ['legacy/', '*.gen.ts', '!keep.gen.ts'],
        }),
        'src/deep/legacy/old.ts': branchy('old', 11),
        'src/a.gen.ts': branchy('generated', 11),
        'src/keep.gen.ts': branchy('kept', 11),
      });
      coverage(cwd, ['src/keep.gen.ts']);

      const result = oxcrap(cwd, []);

      expect(result.output).toContain('- src/keep.gen.ts:1 kept: CRAP 156');
      expect(result.output).not.toMatch(/old:|generated:/);
    });

    it('uses its limits and ignorePatterns', () => {
      const cwd = project({
        '.oxcraprc.json': rc({
          coverage: 'coverage.json',
          limits: { crap: 200, complexity: 20 },
          ignorePatterns: ['**/legacy/**'],
        }),
        'src/grade.ts': branchy('grade', 11),
        'src/legacy/old.ts': branchy('old', 30),
      });
      coverage(cwd, ['src/grade.ts']);

      const result = oxcrap(cwd, []);

      expect(result.output).toContain('No CRAP findings.');
      expect(result.status).toBe(0);
    });

    it('lets the command line override it: paths replace its files, and options its settings', () => {
      const cwd = project({
        '.oxcraprc.json': rc({ files: ['lib/**/*.ts'], coverage: 'old.json', helpUrl: 'A.md' }),
        'lib/fine.ts': 'export const fine = 1;\n',
        'B.md': '# Help\n',
        'src/grade.ts': branchy('grade', 11),
      });
      coverage(cwd, ['src/grade.ts']);

      const result = oxcrap(cwd, ['--coverage', 'coverage.json', '--help-url', 'B.md', 'src']);

      expect(result.output).toContain('- src/grade.ts:1 grade: CRAP 156');
      expect(result.output).toContain('Get help: B.md');
    });

    it('says what’s wrong with a missing or invalid config, or files that match nothing', () => {
      const cwd = project({ 'src/keep.ts': 'export const keep = 1;\n' });
      coverage(cwd, ['src/keep.ts']);

      expect(oxcrap(cwd, ['-c', 'nope.json']).output).toContain('No config file at nope.json.');

      write(cwd, { '.oxcraprc.json': rc({ coverage: 'coverage.json', limit: { crap: 30 } }) });
      expect(oxcrap(cwd, []).output).toContain(
        '.oxcraprc.json has no option "limit". The options are files, ignorePatterns, limits, coverage, helpUrl.',
      );

      write(cwd, { '.oxcraprc.json': rc({ coverage: 'coverage.json', files: ['lib/**'] }) });
      const none = oxcrap(cwd, []);
      expect(none.status).toBe(1);
      expect(none.output).toContain(
        'No files to score: nothing matches "files" in .oxcraprc.json that "ignorePatterns" leaves in.',
      );
    });
  });
});
