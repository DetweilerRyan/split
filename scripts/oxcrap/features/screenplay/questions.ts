import type { Question } from './actor.ts';

/** Everything the last run printed, with no colour codes. */
export const theOutput: Question<string> = (actor) => actor.recall('run').output;

/** What the last run exited with. */
export const theExitCode: Question<number | null> = (actor) => actor.recall('run').status;
