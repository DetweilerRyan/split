import type { Actor } from './actor.ts';

/** Everything the last run printed, with no colour codes. */
export function theOutput(actor: Actor): string {
  return actor.recall('run').output;
}

/** What the last run exited with. */
export function theExitCode(actor: Actor): number | null {
  return actor.recall('run').status;
}
