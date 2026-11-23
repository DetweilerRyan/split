Feature: Reading the coverage report
  The check scores the code against the coverage report the tests wrote, and refuses one that
  can't be the report for the code as it is.

  Scenario: With no coverage report, the check refuses to score
    Given Dana has a file "src/keep.ts" with no functions
    When Dana runs "oxcrap --coverage coverage.json src"
    Then Dana's check fails
    And Dana sees:
      """
      No coverage report at coverage.json. Run the tests with coverage first; a run whose tests fail may write none.
      """

  Scenario: A report older than the code is refused
    Given Dana has a file "src/keep.ts" with no functions
    And Dana's tests ran none of "src/keep.ts"
    And Dana has changed "src/keep.ts" since the tests ran
    When Dana runs "oxcrap --coverage coverage.json src"
    Then Dana's check fails
    And Dana sees:
      """
      The coverage report at coverage.json is older than src/keep.ts. Run the tests again, so it covers the code as it is.
      """

  Scenario: A report older than a test file is refused, though tests aren't scored
    Given Dana has a file "src/keep.ts" with no functions
    And Dana has a file "src/keep.test.ts" with no functions
    And Dana's tests ran none of "src/keep.ts"
    And Dana has changed "src/keep.test.ts" since the tests ran
    When Dana runs "oxcrap --coverage coverage.json src"
    Then Dana sees "The coverage report at coverage.json is older than src/keep.test.ts."

  Scenario: A report that covers none of the files being scored is refused
    Given Dana has a function "grade" with complexity 12 in "src/grade.ts"
    And Dana has a file "lib/other.ts" with no functions
    And Dana's tests ran none of "lib/other.ts"
    When Dana runs "oxcrap --coverage coverage.json src"
    Then Dana sees:
      """
      The coverage report at coverage.json covers none of the 1 files being scored. Is it the report for this code, written from this folder?
      """

  Scenario: A report missing a part the scoring reads is refused
    Given Dana has a file "src/keep.ts" with no functions
    And Dana's coverage report for "src/keep.ts" has statements but no functions
    When Dana runs "oxcrap --coverage coverage.json src"
    Then Dana sees "coverage.json isn't an istanbul JSON coverage report, such as coverage-final.json."

  Scenario: Coverage is matched to files reached through a symlink, as the test run saw them
    Given Dana has a function "grade" with complexity 5 in "src/grade.ts"
    And Dana has a file ".oxcraprc.json":
      """
      { "coverage": "coverage.json" }
      """
    And Dana's tests ran all of "src/grade.ts"
    And Dana has linked the project as "project" in another folder
    When Dana runs "oxcrap -c project/.oxcraprc.json" in that other folder
    Then Dana's check passes
    And Dana sees "No CRAP findings."
