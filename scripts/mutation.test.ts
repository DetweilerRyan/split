import { describe, expect, it } from 'vitest';
import { changedRanges } from './mutation.ts';

const diff = (file: string, hunks: string[]) =>
  [`diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`, ...hunks].join('\n');

describe('changedRanges', () => {
  it('gives each added or changed run of lines as file:start-end', () => {
    const text = diff('scripts/oxcrap/check.ts', [
      '@@ -10,2 +10,3 @@ export function check',
      '+a',
      '@@ -40 +41 @@',
      '+b',
    ]);
    expect(changedRanges(text)).toEqual([
      'scripts/oxcrap/check.ts:10-12',
      'scripts/oxcrap/check.ts:41-41',
    ]);
  });

  it('leaves out a hunk that only deletes lines, since nothing is left to mutate', () => {
    expect(changedRanges(diff('scripts/oxcrap/check.ts', ['@@ -5,3 +4,0 @@']))).toEqual([]);
  });

  it('leaves out tests, the feature contract, deleted files and files outside oxCrap', () => {
    const text = [
      diff('scripts/oxcrap/check.test.ts', ['@@ -1 +1 @@']),
      diff('scripts/oxcrap/features/steps/oxcrap.steps.ts', ['@@ -1 +1 @@']),
      diff('src/utils/math.ts', ['@@ -1 +1 @@']),
      [
        'diff --git a/scripts/oxcrap/old.ts b/scripts/oxcrap/old.ts',
        '--- a/scripts/oxcrap/old.ts',
        '+++ /dev/null',
        '@@ -1,3 +0,0 @@',
      ].join('\n'),
    ].join('\n');
    expect(changedRanges(text)).toEqual([]);
  });

  it('reads a path with a space, which git ends with a tab', () => {
    const text = [
      'diff --git a/scripts/oxcrap/a b.ts b/scripts/oxcrap/a b.ts',
      '--- a/scripts/oxcrap/a b.ts\t',
      '+++ b/scripts/oxcrap/a b.ts\t',
      '@@ -1 +1 @@',
    ].join('\n');
    expect(changedRanges(text)).toEqual(['scripts/oxcrap/a b.ts:1-1']);
  });

  it('never counts a hunk against the file before it, if a path can’t be read', () => {
    const text = [
      diff('scripts/oxcrap/check.ts', ['@@ -1 +1 @@']),
      'diff --git "a/scripts/oxcrap/\\303\\251.ts" "b/scripts/oxcrap/\\303\\251.ts"',
      '+++ "b/scripts/oxcrap/\\303\\251.ts"',
      '@@ -50 +50 @@',
    ].join('\n');
    expect(changedRanges(text)).toEqual(['scripts/oxcrap/check.ts:1-1']);
  });
});
