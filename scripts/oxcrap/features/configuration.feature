Feature: Configuring the check
  A config file sets which files are scored, the limits, the coverage report and where to get
  help. Its paths are read from its own folder, and it covers only that folder.

  Scenario: The check reads .oxcraprc.json in the folder it runs in, comments and all
    Given Dana has a function "grade" with complexity 12 in "lib/grade.ts"
    And Dana has a function "ignored" with complexity 12 in "src/ignored.ts"
    And Dana has a help page "HELP.md"
    And Dana has a file ".oxcraprc.json":
      """
      {
        // Comments are allowed, as in oxlint's and oxfmt's configs.
        "files": ["lib/**/*.ts"],
        "coverage": "coverage.json",
        "helpUrl": "HELP.md",
      }
      """
    And Dana's tests ran none of "lib/grade.ts"
    When Dana runs "oxcrap"
    Then Dana's check fails
    And Dana sees "- lib/grade.ts:1 grade: CRAP 156"
    And Dana doesn't see "ignored"
    And Dana sees "Get help: HELP.md"

  Scenario: A config named with --config has its paths read from its own folder
    Given Dana has a function "grade" with complexity 12 in "web/src/grade.ts"
    And Dana has a function "elsewhere" with complexity 12 in "src/elsewhere.ts"
    And Dana has a file "web/crap.json":
      """
      { "files": ["src/**/*.ts"], "coverage": "../coverage.json" }
      """
    And Dana's tests ran none of "web/src/grade.ts"
    When Dana runs "oxcrap --config web/crap.json"
    Then Dana's check fails
    And Dana sees "- web/src/grade.ts:1 grade: CRAP 156"
    And Dana doesn't see "elsewhere"

  Scenario: Files are named from the folder the check runs in, wherever its config is
    Given Dana has a function "grade" with complexity 12 in "web/src/grade.ts"
    And Dana has a file "web/crap.json":
      """
      { "files": ["src/**/*.ts"], "coverage": "../coverage.json" }
      """
    And Dana's tests ran none of "web/src/grade.ts"
    When Dana runs "oxcrap -c crap.json" in "web"
    Then Dana sees "- src/grade.ts:1 grade: CRAP 156"

  Scenario Outline: A files glob with ".." in it is refused
    Given Dana has a file "src/keep.ts" with no functions
    And Dana has a file ".oxcraprc.json":
      """
      { "coverage": "coverage.json", "files": ["<glob>"] }
      """
    And Dana's tests ran none of "src/keep.ts"
    When Dana runs "oxcrap"
    Then Dana sees:
      """
      can't reach outside the config's folder, as "<glob>" does.
      """

    Examples:
      | glob                 |
      | src/../../other/*.ts |
      | {src,../other}/*.ts  |

  Scenario: A folder given as the config is refused
    Given Dana has a file "src/keep.ts" with no functions
    And Dana's tests ran none of "src/keep.ts"
    When Dana runs "oxcrap -c src"
    Then Dana sees "src is a folder, not a config file."

  Scenario: A config's files can't reach outside its folder
    Given Dana has a function "grade" with complexity 12 in "src/grade.ts"
    And Dana has a file "web/crap.json":
      """
      { "files": ["../src/**/*.ts"], "coverage": "../coverage.json" }
      """
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap -c web/crap.json"
    Then Dana sees:
      """
      web/crap.json: "files" can't reach outside the config's folder, as "../src/**/*.ts" does.
      """

  Scenario: A path outside the folder the check runs in is refused
    Given Dana has a function "grade" with complexity 12 in "src/grade.ts"
    And Dana has a file "web/keep.ts" with no functions
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap --coverage ../coverage.json ../src" in "web"
    Then Dana sees "../src is outside ., the folder oxCrap scores."

  Scenario: The config's limits and ignorePatterns are used
    Given Dana has a function "grade" with complexity 12 in "src/grade.ts"
    And Dana has a function "old" with complexity 31 in "src/legacy/old.ts"
    And Dana has a file ".oxcraprc.json":
      """
      {
        "coverage": "coverage.json",
        "limits": { "crap": 200, "complexity": 20 },
        "ignorePatterns": ["**/legacy/**"]
      }
      """
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap"
    Then Dana's check passes
    And Dana sees "No CRAP findings."

  Scenario: The command line overrides the config: paths replace its files, and options its settings
    Given Dana has a function "grade" with complexity 12 in "src/grade.ts"
    And Dana has a file "lib/fine.ts" with no functions
    And Dana has a help page "B.md"
    And Dana has a file ".oxcraprc.json":
      """
      { "files": ["lib/**/*.ts"], "coverage": "old.json", "helpUrl": "A.md" }
      """
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap --coverage coverage.json --help-url B.md src"
    Then Dana sees "- src/grade.ts:1 grade: CRAP 156"
    And Dana sees "Get help: B.md"

  Scenario: A config file that doesn't exist is an error
    Given Dana has a file "src/keep.ts" with no functions
    And Dana's tests ran none of "src/keep.ts"
    When Dana runs "oxcrap -c nope.json"
    Then Dana sees "No config file at nope.json."

  Scenario: An option the config doesn't have is an error that lists the ones it does
    Given Dana has a file "src/keep.ts" with no functions
    And Dana has a file ".oxcraprc.json":
      """
      { "coverage": "coverage.json", "limit": { "crap": 30 } }
      """
    And Dana's tests ran none of "src/keep.ts"
    When Dana runs "oxcrap"
    Then Dana sees:
      """
      .oxcraprc.json has no option "limit". The options are files, ignorePatterns, limits, coverage, helpUrl.
      """

  Scenario: Files that match nothing are an error
    Given Dana has a file "src/keep.ts" with no functions
    And Dana has a file ".oxcraprc.json":
      """
      { "coverage": "coverage.json", "files": ["lib/**"] }
      """
    And Dana's tests ran none of "src/keep.ts"
    When Dana runs "oxcrap"
    Then Dana's check fails
    And Dana sees:
      """
      No files to score: nothing matches "files" in .oxcraprc.json that "ignorePatterns" leaves in.
      """
