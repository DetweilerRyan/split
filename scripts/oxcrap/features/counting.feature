Feature: Counting what branches
  By default every kind of branching counts towards a function's complexity: a nested function's
  branches count towards the function around it, and so do default values, each ?. link, labelled
  jumps, recursion and reading a lookup table that stands for a switch or a chain of conditions.
  The config's counting option turns any of them off.

  Scenario: A callback's branches count towards the function it's written in
    Given Dana has a file "src/grade.ts":
      """
      export function grade(items: number[]) {
        return items.map((n) => {
          if (n === 0) return 0;
          if (n === 1) return 1;
          if (n === 2) return 2;
          if (n === 3) return 3;
          if (n === 4) return 4;
          if (n === 5) return 5;
          if (n === 6) return 6;
          if (n === 7) return 7;
          if (n === 8) return 8;
          if (n === 9) return 9;
          if (n === 10) return 10;
          return -1;
        });
      }
      """
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap --coverage coverage.json src"
    Then Dana's check fails
    And Dana sees "- src/grade.ts:1 grade: CRAP 156, complexity 12, coverage 0%."
    And Dana doesn't see "items.map callback"

  Scenario: With nested functions scored on their own, the callback is the one over the limits
    Given Dana has a file "src/grade.ts":
      """
      export function grade(items: number[]) {
        return items.map((n) => {
          if (n === 0) return 0;
          if (n === 1) return 1;
          if (n === 2) return 2;
          if (n === 3) return 3;
          if (n === 4) return 4;
          if (n === 5) return 5;
          if (n === 6) return 6;
          if (n === 7) return 7;
          if (n === 8) return 8;
          if (n === 9) return 9;
          if (n === 10) return 10;
          return -1;
        });
      }
      """
    And Dana has a file ".oxcraprc.json":
      """
      { "coverage": "coverage.json", "counting": { "nestedFunctions": "own" } }
      """
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap"
    Then Dana sees "- src/grade.ts:2 grade > items.map callback: CRAP 156, complexity 12, coverage 0%."
    And Dana doesn't see "src/grade.ts:1 grade:"

  Scenario: The config can turn off counting default values
    Given Dana has a file "src/grade.ts":
      """
      export function grade(a = 0, b = 1, c = 2, d = 3, e = 4, f = 5, g = 6, h = 7, i = 8, j = 9, k = 10) {
        return a + b + c + d + e + f + g + h + i + j + k;
      }
      """
    And Dana has a file ".oxcraprc.json":
      """
      { "coverage": "coverage.json", "counting": { "defaultValues": false } }
      """
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap"
    Then Dana's check passes
    And Dana sees "No CRAP findings."

  Scenario: Each ?. counts by default
    Given Dana has a file "src/grade.ts":
      """
      export function grade(o: any) {
        return o?.a?.b?.c?.d?.e?.f?.g?.h?.i?.j?.k;
      }
      """
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap --coverage coverage.json src"
    Then Dana's check fails
    And Dana sees "- src/grade.ts:1 grade: CRAP 156, complexity 12, coverage 0%."

  Scenario: Default values count by default
    Given Dana has a file "src/grade.ts":
      """
      export function grade(a = 0, b = 1, c = 2, d = 3, e = 4, f = 5, g = 6, h = 7, i = 8, j = 9, k = 10) {
        return a + b + c + d + e + f + g + h + i + j + k;
      }
      """
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap --coverage coverage.json src"
    Then Dana's check fails
    And Dana sees "- src/grade.ts:1 grade: CRAP 156, complexity 12, coverage 0%."

  Scenario: The config can turn off counting ?.
    Given Dana has a file "src/grade.ts":
      """
      export function grade(o: any) {
        return o?.a?.b?.c?.d?.e?.f?.g?.h?.i?.j?.k;
      }
      """
    And Dana has a file ".oxcraprc.json":
      """
      { "coverage": "coverage.json", "counting": { "optionalChaining": false } }
      """
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap"
    Then Dana's check passes
    And Dana sees "No CRAP findings."

  Scenario: A function that calls itself adds 1 for its recursion
    Given Dana has a file "src/grade.ts":
      """
      export function grade(n: number): number {
        if (n === 0) return 0;
        if (n === 1) return 1;
        if (n === 2) return 2;
        if (n === 3) return 3;
        if (n === 4) return 4;
        if (n === 5) return 5;
        if (n === 6) return 6;
        if (n === 7) return 7;
        if (n === 8) return 8;
        if (n === 9) return 9;
        return grade(n - 1);
      }
      """
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap --coverage coverage.json src"
    Then Dana's check fails
    And Dana sees "- src/grade.ts:1 grade: CRAP 156, complexity 12, coverage 0%."

  Scenario: The config can count a whole switch once
    Given Dana has a file "src/grade.ts":
      """
      export function grade(n: number) {
        switch (n) {
          case 0:
            return 0;
          case 1:
            return 1;
          case 2:
            return 2;
          case 3:
            return 3;
          case 4:
            return 4;
          case 5:
            return 5;
          case 6:
            return 6;
          case 7:
            return 7;
          case 8:
            return 8;
          case 9:
            return 9;
          case 10:
            return 10;
        }
        return -1;
      }
      """
    And Dana has a file ".oxcraprc.json":
      """
      { "coverage": "coverage.json", "counting": { "switchCases": "once" } }
      """
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap"
    Then Dana's check passes
    And Dana sees "No CRAP findings."

  Scenario: A @crap-allow comment above a nested function says which function to move it to
    Given Dana has a file "src/grade.ts":
      """
      export function grade(items: number[]) {
        // @crap-allow CRAP 2, complexity 2. One branch.
        return items.map((n) => (n ? 1 : 0));
      }
      """
    And Dana's tests ran all of "src/grade.ts"
    When Dana runs "oxcrap --coverage coverage.json src"
    Then Dana's check fails
    And Dana sees:
      """
      This @crap-allow comment is above grade > items.map callback, which is inside grade and counts towards it. Move the comment above grade, with its numbers.
      """

  Scenario: A switch moved into a table of functions still counts its cases
    Given Dana has a file "src/grade.ts":
      """
      const RULES = { k0: () => 0, k1: () => 1, k2: () => 2, k3: () => 3, k4: () => 4, k5: () => 5, k6: () => 6, k7: () => 7, k8: () => 8, k9: () => 9 };
      export function grade(k: string) {
        return RULES[k]();
      }
      """
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap --coverage coverage.json src"
    Then Dana's check fails
    And Dana sees "- src/grade.ts:2 grade: CRAP 132, complexity 11, coverage 0%."

  Scenario: Reading a table of plain values adds nothing
    Given Dana has a file "src/grade.ts":
      """
      const CODES = { k0: 'C0', k1: 'C1', k2: 'C2', k3: 'C3', k4: 'C4', k5: 'C5', k6: 'C6', k7: 'C7', k8: 'C8', k9: 'C9', k10: 'C10' };
      export function grade(k: string) {
        return CODES[k];
      }
      """
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap --coverage coverage.json src"
    Then Dana's check passes
    And Dana sees "No CRAP findings."

  Scenario: The config can turn off counting lookup tables
    Given Dana has a file "src/grade.ts":
      """
      const RULES = { k0: () => 0, k1: () => 1, k2: () => 2, k3: () => 3, k4: () => 4, k5: () => 5, k6: () => 6, k7: () => 7, k8: () => 8, k9: () => 9 };
      export function grade(k: string) {
        return RULES[k]();
      }
      """
    And Dana has a file ".oxcraprc.json":
      """
      { "coverage": "coverage.json", "counting": { "lookupTables": false } }
      """
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap"
    Then Dana's check passes
    And Dana sees "No CRAP findings."
