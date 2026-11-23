Feature: Allowing a function over the limits
  A @crap-allow comment directly above a function lets it stay over the limits, as long as the
  comment's numbers are the function's current ones.

  Scenario: A function whose comment gives its current numbers passes
    Given Dana has a function "grade" with complexity 12 in "src/grade.ts"
    And Dana has written "// @crap-allow CRAP 156, complexity 12. One per rate." above "grade" in "src/grade.ts"
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap --coverage coverage.json src"
    Then Dana's check passes

  Scenario: A function that has grown past its comment's numbers fails
    Given Dana has a function "grade" with complexity 13 in "src/grade.ts"
    And Dana has written "// @crap-allow CRAP 156, complexity 12. One per rate." above "grade" in "src/grade.ts"
    And Dana's tests ran none of "src/grade.ts"
    When Dana runs "oxcrap --coverage coverage.json src"
    Then Dana's check fails
    And Dana sees:
      """
      - src/grade.ts:1 grade: CRAP 182, complexity 13, coverage 0%, but its @crap-allow comment says CRAP 156, complexity 12. Update the comment to `// @crap-allow CRAP 182, complexity 13.`, and check its reason still holds.
      """
