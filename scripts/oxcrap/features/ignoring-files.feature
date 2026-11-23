Feature: Leaving files out
  The check leaves out what the .gitignore beside its config lists, as oxlint does, and what the
  config's ignorePatterns list, read as a .gitignore is.

  Scenario: What the .gitignore lists is left out
    Given Dana has a function "grade" with complexity 12 in "src/grade.ts"
    And Dana has a function "types" with complexity 12 in "src/generated/types.ts"
    And Dana has a function "api" with complexity 12 in "src/api.gen.ts"
    And Dana has a file ".gitignore":
      """
      generated/
      *.gen.ts
      """
    And Dana has a file ".oxcraprc.json":
      """
      { "coverage": "coverage.json" }
      """
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap"
    Then Dana sees "- src/grade.ts:1 grade: CRAP 156"
    And Dana doesn't see "types:"
    And Dana doesn't see "api:"

  Scenario: A gitignored file written after the tests ran doesn't make the report stale
    Given Dana has a file "src/keep.ts" with no functions
    And Dana has a file "src/api.gen.js" with no functions
    And Dana has a file ".gitignore":
      """
      *.gen.js
      """
    And Dana has a file ".oxcraprc.json":
      """
      { "coverage": "coverage.json" }
      """
    And Dana's tests ran none of "src/keep.ts"
    And Dana has changed "src/api.gen.js" since the tests ran
    When Dana runs "oxcrap"
    Then Dana's check passes
    And Dana sees "No CRAP findings."

  Scenario: The .gitignore read is the one beside the config, not in the folder the check runs in
    Given Dana has a function "old" with complexity 12 in "web/src/legacy/old.ts"
    And Dana has a file "web/src/grade.ts" with no functions
    And Dana has a file "web/.gitignore":
      """
      legacy/
      """
    And Dana has a file "web/crap.json":
      """
      { "files": ["src/**/*.ts"], "coverage": "../coverage.json" }
      """
    And Dana's tests ran none of "web/src/grade.ts"
    When Dana runs "oxcrap -c web/crap.json"
    Then Dana sees "No CRAP findings."

  Scenario: A ! in ignorePatterns can't bring back what the .gitignore lists
    Given Dana has a file "src/keep.ts" with no functions
    And Dana has a function "api" with complexity 12 in "src/api.gen.ts"
    And Dana has a file ".gitignore":
      """
      *.gen.ts
      """
    And Dana has a file ".oxcraprc.json":
      """
      { "coverage": "coverage.json", "ignorePatterns": ["!api.gen.ts"] }
      """
    And Dana's tests ran none of "src/keep.ts"
    When Dana runs "oxcrap"
    Then Dana sees "No CRAP findings."

  Scenario: ignorePatterns are read as a .gitignore is: a folder at any depth, and ! to bring a file back
    Given Dana has a function "old" with complexity 12 in "src/deep/legacy/old.ts"
    And Dana has a function "generated" with complexity 12 in "src/a.gen.ts"
    And Dana has a function "kept" with complexity 12 in "src/keep.gen.ts"
    And Dana has a file ".oxcraprc.json":
      """
      { "coverage": "coverage.json", "ignorePatterns": ["legacy/", "*.gen.ts", "!keep.gen.ts"] }
      """
    And Dana's tests ran none of "src/keep.gen.ts"
    When Dana runs "oxcrap"
    Then Dana sees "- src/keep.gen.ts:1 kept: CRAP 156"
    And Dana doesn't see "old:"
    And Dana doesn't see "generated:"
