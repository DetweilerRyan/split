Feature: Pointing to help
  A helpUrl in the config, or --help-url, is printed after any findings as where to get help.

  Scenario: A help file the config names must exist on every run, even with no findings
    Given Dana has a file "src/keep.ts" with no functions
    And Dana has a file ".oxcraprc.json":
      """
      { "coverage": "coverage.json", "helpUrl": "docs/help.md" }
      """
    And Dana's tests ran none of "src/keep.ts"
    When Dana runs "oxcrap"
    Then Dana's check fails
    And Dana sees:
      """
      No help file at docs/help.md, which "helpUrl" in .oxcraprc.json names.
      """

  Scenario: A helpUrl that is a web address is printed as it is, without checking it
    Given Dana has a function "grade" with complexity 12 in "src/grade.ts"
    And Dana has a file ".oxcraprc.json":
      """
      { "coverage": "coverage.json", "helpUrl": "https://example.com/crap" }
      """
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap"
    Then Dana sees "Get help: https://example.com/crap"

  Scenario: A help file is read from the config's folder, and printed from the folder the check runs in
    Given Dana has a function "grade" with complexity 12 in "web/src/grade.ts"
    And Dana has a help page "web/docs/help.md"
    And Dana has a file "web/crap.json":
      """
      { "files": ["src/**/*.ts"], "coverage": "../coverage.json", "helpUrl": "docs/help.md" }
      """
    And Dana's tests ran none of "web/src/grade.ts"
    When Dana runs "oxcrap -c web/crap.json"
    Then Dana sees "Get help: web/docs/help.md"
