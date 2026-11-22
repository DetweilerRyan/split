import { describe, expect, it } from 'vitest';
import { isChanged, parseDiff } from './diff.ts';

const diff = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -3 +3 @@ function a() {
-  return 1;
+  return 2;
@@ -10,0 +11,2 @@ function b() {
+  x();
+  y();
@@ -20,2 +22,0 @@ function c() {
-  gone();
-  gone();
diff --git a/src/old.ts b/src/old.ts
--- a/src/old.ts
+++ /dev/null
@@ -1 +0,0 @@
-export const old = 1;
`;

describe('parseDiff', () => {
  it('reads the changed lines on the new side of each hunk', () => {
    const lines = parseDiff(diff).get('src/a.ts') as Set<number>;
    expect([...lines].sort((a, b) => a - b)).toEqual([3, 11, 12, 22, 23]);
  });

  it('marks the lines either side of a deletion as changed', () => {
    expect(parseDiff(diff).get('src/a.ts')).toContain(22);
    expect(parseDiff(diff).get('src/a.ts')).toContain(23);
  });

  it('leaves out a deleted file', () => {
    expect([...parseDiff(diff).keys()]).toEqual(['src/a.ts']);
  });
});

describe('isChanged', () => {
  it('says whether any line in a range changed', () => {
    const lines = new Set([3, 11]);
    expect([isChanged(lines, 1, 3), isChanged(lines, 4, 10), isChanged(undefined, 1, 99)]).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('counts every line of a new file as changed', () => {
    expect(isChanged('all', 50, 60)).toBe(true);
  });
});
