Feature: Scoring functions
  The check scores every function in the code it's given, from its complexity and the share of it
  the tests ran, and fails on any function over the limits.

  Scenario: A function over the limits fails, with the comment that would allow it and where to get help
    Given Dana has a function "grade" with complexity 12 in "src/grade.ts"
    And Dana has a file "HELP.md" with no functions
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap --coverage coverage.json --help-url HELP.md src"
    Then Dana's check fails
    And Dana sees:
      """
      - src/grade.ts:1 grade: CRAP 156, complexity 12, coverage 0%. Over the limits (CRAP 30, complexity 10). To leave it, add `// @crap-allow CRAP 156, complexity 12. <reason>` directly above it.
      """
    And Dana sees "Get help: HELP.md"

  Scenario: A function the tests run all of passes
    Given Dana has a function "grade" with complexity 5 in "src/grade.ts"
    And Dana's tests ran all of "src/grade.ts"
    When Dana runs "oxcrap --coverage coverage.json src"
    Then Dana's check passes
    And Dana sees "No CRAP findings."

  Scenario: A folder's files are scored, but not its tests, node_modules or dot-folders
    Given Dana has a function "rank" with complexity 12 in "src/deep/rank.ts"
    And Dana has a function "rankTest" with complexity 12 in "src/rank.test.ts"
    And Dana has a function "lib" with complexity 12 in "src/node_modules/lib/index.ts"
    And Dana has a function "built" with complexity 12 in "src/.cache/built.ts"
    And Dana's tests ran none of "src/deep/rank.ts"
    When Dana runs "oxcrap --coverage coverage.json src"
    Then Dana's check fails
    And Dana sees "- src/deep/rank.ts:1 rank: CRAP 156"
    And Dana doesn't see "rankTest"
    And Dana doesn't see "lib:"
    And Dana doesn't see "built:"

  Scenario: Files are named from the folder the check runs in
    Given Dana has a function "grade" with complexity 12 in "src/grade.ts"
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap --coverage ../coverage.json ." in "src"
    Then Dana's check fails
    And Dana sees "- grade.ts:1 grade: CRAP 156"

  Scenario: A single file named on the command line is the only one scored
    Given Dana has a function "grade" with complexity 12 in "src/grade.ts"
    And Dana has a function "rank" with complexity 12 in "src/rank.ts"
    And Dana's tests ran none of "src/grade.ts"
    And Dana's tests ran none of "src/rank.ts"
    When Dana runs "oxcrap --coverage coverage.json src/grade.ts"
    Then Dana sees "- src/grade.ts:1 grade: CRAP 156"
    And Dana doesn't see "rank"

  Scenario: A path that doesn't exist is an error
    Given Dana has a file "src/keep.ts" with no functions
    And Dana's tests ran none of "src/keep.ts"
    When Dana runs "oxcrap --coverage coverage.json lib"
    Then Dana sees "No file or folder at lib."

  Scenario: With no coverage report given, the check says how to give one
    Given Dana has a file "src/keep.ts" with no functions
    And Dana's tests ran none of "src/keep.ts"
    When Dana runs "oxcrap src"
    Then Dana sees:
      """
      Usage: node scripts/oxcrap/oxcrap.ts [-c <config>] [--coverage <report>] [--help-url <url>] [<path>...]
      Give the coverage report with --coverage, or as "coverage" in .oxcraprc.json.
      """
