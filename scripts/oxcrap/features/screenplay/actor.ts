import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Something an actor does, made of interactions with the abilities the actor has. */
export type Task = (actor: Actor) => void;
/** Something an actor finds out. */
export type Question<T> = (actor: Actor) => T;

/** What one run of the check gave back. */
export type Run = {
  readonly status: number | null;
  readonly output: string;
};

/** A file's share of a test run: every statement in it ran, or none did. */
export type Covered = 'all' | 'none';

/** What an actor can remember between steps. */
export type Notes = {
  readonly run: Run;
  readonly coverage: ReadonlyMap<string, Covered>;
  readonly otherFolder: string;
};

// The CLI under test, run as a program, as a developer runs it. oxCrap's folder imports nothing
// from outside it, so the screenplay reaches the CLI by path rather than by importing it.
const cli = fileURLToPath(new URL('../../oxcrap.ts', import.meta.url));

/**
 * A developer in a scenario. Their abilities: a project folder of their own, a plain folder with
 * no git and no package.json, created on first use and deleted after the scenario; and running
 * the check in it.
 */
export type Actor = {
  readonly name: string;
  readonly attemptsTo: (...tasks: readonly Task[]) => void;
  readonly answer: <T>(question: Question<T>) => T;
  /** The actor's project folder. */
  readonly project: string;
  /** Another throwaway folder, outside the project, deleted with it. */
  readonly elsewhere: () => string;
  /** Runs the check with `args`, from `cwd` (the project folder by default). */
  readonly runsTheCheck: (args: readonly string[], cwd?: string) => Run;
  readonly remember: <K extends keyof Notes>(key: K, value: Notes[K]) => void;
  readonly recall: <K extends keyof Notes>(key: K) => Notes[K];
  readonly has: (key: keyof Notes) => boolean;
  readonly exit: () => void;
};

/** A new actor called `name`, whose folders and notes are their own. */
export function createActor(name: string): Actor {
  let folder: string | undefined;
  const others: string[] = [];
  const notes = new Map<keyof Notes, Notes[keyof Notes]>();

  function attemptsTo(...tasks: readonly Task[]): void {
    for (const task of tasks) task(actor);
  }

  function answer<T>(question: Question<T>): T {
    return question(actor);
  }

  function project(): string {
    folder ??= mkdtempSync(join(tmpdir(), 'oxcrap-feature-'));
    return folder;
  }

  function elsewhere(): string {
    const other = mkdtempSync(join(tmpdir(), 'oxcrap-feature-elsewhere-'));
    others.push(other);
    return other;
  }

  function runsTheCheck(args: readonly string[], cwd = project()): Run {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    });
    if (result.error !== undefined) throw result.error;
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  }

  function remember<K extends keyof Notes>(key: K, value: Notes[K]): void {
    notes.set(key, value);
  }

  function recall<K extends keyof Notes>(key: K): Notes[K] {
    if (!notes.has(key)) throw new Error(`${name} doesn't remember a ${key}.`);
    return notes.get(key) as Notes[K];
  }

  function has(key: keyof Notes): boolean {
    return notes.has(key);
  }

  function exit(): void {
    for (const each of [folder, ...others]) {
      if (each !== undefined) rmSync(each, { recursive: true, force: true });
    }
  }

  const actor: Actor = {
    name,
    attemptsTo,
    answer,
    get project() {
      return project();
    },
    elsewhere,
    runsTheCheck,
    remember,
    recall,
    has,
    exit,
  };
  return actor;
}
