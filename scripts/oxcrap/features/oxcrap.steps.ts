import { expect } from '@playwright/test';
import { Given, Then, When } from './screenplay/fixtures.ts';
import { theExitCode, theOutput } from './screenplay/questions.ts';
import {
  changesAfterTheTests,
  linksTheProject,
  runsTests,
  runsTheCheck,
  writesCommentAbove,
  writesFile,
  writesFunction,
  writesReportWithoutFunctions,
} from './screenplay/tasks.ts';

Given(
  '{word} has a function {string} with complexity {int} in {string}',
  ({ actorCalled }, name: string, fn: string, complexity: number, path: string) => {
    actorCalled(name).attemptsTo(writesFunction(path, fn, complexity));
  },
);

Given(
  '{word} has a file {string} with no functions',
  ({ actorCalled }, name: string, path: string) => {
    actorCalled(name).attemptsTo(writesFile(path, 'export const keep = 1;'));
  },
);

Given(
  '{word} has a file {string}:',
  ({ actorCalled }, name: string, path: string, text: string) => {
    actorCalled(name).attemptsTo(writesFile(path, text));
  },
);

Given(
  '{word} has written {string} above {string} in {string}',
  ({ actorCalled }, name: string, comment: string, fn: string, path: string) => {
    actorCalled(name).attemptsTo(writesCommentAbove(path, fn, comment));
  },
);

Given('{word} has a help page {string}', ({ actorCalled }, name: string, path: string) => {
  actorCalled(name).attemptsTo(writesFile(path, '# Help'));
});

Given(
  "{word}'s tests ran {word} of {string}",
  ({ actorCalled }, name: string, share: string, path: string) => {
    actorCalled(name).attemptsTo(runsTests(path, share));
  },
);

Given(
  "{word}'s coverage report for {string} has statements but no functions",
  ({ actorCalled }, name: string, path: string) => {
    actorCalled(name).attemptsTo(writesReportWithoutFunctions(path));
  },
);

Given(
  '{word} has changed {string} since the tests ran',
  ({ actorCalled }, name: string, path: string) => {
    actorCalled(name).attemptsTo(changesAfterTheTests(path));
  },
);

Given(
  '{word} has linked the project as {string} in another folder',
  ({ actorCalled }, name: string, link: string) => {
    actorCalled(name).attemptsTo(linksTheProject(link));
  },
);

When('{word} runs {string}', ({ actorCalled }, name: string, commandLine: string) => {
  actorCalled(name).attemptsTo(runsTheCheck(commandLine));
});

When(
  '{word} runs {string} in {string}',
  ({ actorCalled }, name: string, commandLine: string, folder: string) => {
    actorCalled(name).attemptsTo(runsTheCheck(commandLine, { in: folder }));
  },
);

When(
  '{word} runs {string} in that other folder',
  ({ actorCalled }, name: string, commandLine: string) => {
    actorCalled(name).attemptsTo(runsTheCheck(commandLine, { inTheOtherFolder: true }));
  },
);

Then("{word}'s check fails", ({ actorCalled }, name: string) => {
  expect(actorCalled(name).answer(theExitCode)).toBe(1);
});

Then("{word}'s check passes", ({ actorCalled }, name: string) => {
  expect(actorCalled(name).answer(theExitCode)).toBe(0);
});

Then('{word} sees {string}', ({ actorCalled }, name: string, text: string) => {
  expect(actorCalled(name).answer(theOutput)).toContain(text);
});

Then('{word} sees:', ({ actorCalled }, name: string, text: string) => {
  expect(actorCalled(name).answer(theOutput)).toContain(text);
});

Then("{word} doesn't see {string}", ({ actorCalled }, name: string, text: string) => {
  expect(actorCalled(name).answer(theOutput)).not.toContain(text);
});
