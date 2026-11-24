import { describe, expect, it } from 'vitest';
import { isChecked, isTest, problems, usingFolders } from './check-shared-folders.ts';

const file = 'src/components/RoomEntry.tsx';

describe('isTest', () => {
  it.each([
    'app/RoomApp.test.tsx',
    'app/RoomApp.browser.test.tsx',
    'src/hooks/useX.property.test.ts',
    'src/components/RoomEntry.real.test.ts',
  ])('counts %s as a test', (path) => {
    expect(isTest(path)).toBe(true);
  });

  it.each(['app/RoomApp.tsx', 'app/test/RoomApp.tsx', 'app/latest.ts'])(
    'counts %s as code',
    (path) => {
      expect(isTest(path)).toBe(false);
    },
  );
});

describe('isChecked', () => {
  it('checks a module, and one in a folder of its own', () => {
    expect(isChecked('RoomEntry.tsx')).toBe(true);
    expect(isChecked('room-entry/RoomEntry.tsx')).toBe(true);
  });

  it('leaves out the .gitkeep that keeps an empty folder, and tests', () => {
    expect(isChecked('.gitkeep')).toBe(false);
    expect(isChecked('RoomEntry.browser.test.tsx')).toBe(false);
  });

  it("leaves out a private _ folder's parts, which have one user by design", () => {
    expect(isChecked('_room-entry/Part.tsx')).toBe(false);
    expect(isChecked('room-entry/_part/Part.tsx')).toBe(false);
    expect(isChecked('_Part.tsx')).toBe(true);
  });
});

describe('usingFolders', () => {
  it("gives each importer's folder once, leaving out tests", () => {
    expect(
      usingFolders([
        'app/ingest/_ingest-entry/IngestEntry.tsx',
        'app/RoomApp.tsx',
        'app/Other.tsx',
        'src/x/Y.browser.test.tsx',
      ]),
    ).toEqual(['app', 'app/ingest/_ingest-entry']);
  });
});

describe('problems', () => {
  it('passes a module used from two folders', () => {
    expect(
      problems([
        { file, importers: ['app/RoomApp.tsx', 'app/ingest/_ingest-entry/IngestEntry.tsx'] },
      ]),
    ).toEqual([]);
  });

  it('fails a module with one user, naming it and the folder to move it to', () => {
    expect(problems([{ file, importers: ['app/RoomApp.tsx'] }])).toEqual([
      'src/components/RoomEntry.tsx is used only from app/. Move it into that folder, beside its one user, as docs/engineering/code-layout.md#where-a-module-goes says. src/components/ and src/hooks/ hold only code used from two or more folders.',
    ]);
  });

  it('fails a module with two users in one folder', () => {
    expect(problems([{ file, importers: ['app/a/One.tsx', 'app/a/Two.tsx'] }])).toEqual([
      expect.stringContaining('src/components/RoomEntry.tsx is used only from app/a/.'),
    ]);
  });

  it("fails a module only tests use, since a test isn't a user", () => {
    expect(
      problems([
        { file, importers: ['app/a/One.test.tsx', 'app/b/Two.browser.test.tsx'] },
        { file: 'src/hooks/useX.ts', importers: [] },
      ]),
    ).toEqual([
      "src/components/RoomEntry.tsx isn't imported outside tests. Move it beside the code that uses it, or delete it, as docs/engineering/code-layout.md#where-a-module-goes says. src/components/ and src/hooks/ hold only code used from two or more folders.",
      expect.stringContaining("src/hooks/useX.ts isn't imported outside tests."),
    ]);
  });

  it('fails one user and a test in another folder', () => {
    expect(
      problems([
        { file, importers: ['app/RoomApp.tsx', 'src/components/RoomEntry.browser.test.tsx'] },
      ]),
    ).toEqual([expect.stringContaining('is used only from app/.')]);
  });

  it('passes when there is nothing to check', () => {
    expect(problems([])).toEqual([]);
  });
});
