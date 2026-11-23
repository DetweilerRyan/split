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
export interface Run {
  status: number | null;
  output: string;
}

/** A file's share of a test run: every statement in it ran, or none did. */
export type Covered = 'all' | 'none';

/** What an actor can remember between steps. */
export interface Notes {
  run: Run;
  coverage: Map<string, Covered>;
  otherFolder: string;
}

// The CLI under test, run as a program, as a developer runs it. oxCrap's folder imports nothing
// from outside it, so the screenplay reaches the CLI by path rather than by importing it.
const cli = fileURLToPath(new URL('../../oxcrap.ts', import.meta.url));

/**
 * A developer in a scenario. Their abilities: a project folder of their own, a plain folder with
 * no git and no package.json, created on first use and deleted after the scenario; and running
 * the check in it.
 */
export class Actor {
  #folder: string | undefined;
  readonly #others: string[] = [];
  readonly #notes = new Map<keyof Notes, Notes[keyof Notes]>();

  constructor(readonly name: string) {}

  attemptsTo(...tasks: Task[]): void {
    for (const task of tasks) task(this);
  }

  answer<T>(question: Question<T>): T {
    return question(this);
  }

  /** The actor's project folder. */
  get project(): string {
    this.#folder ??= mkdtempSync(join(tmpdir(), 'oxcrap-feature-'));
    return this.#folder;
  }

  /** Another throwaway folder, outside the project, deleted with it. */
  elsewhere(): string {
    const folder = mkdtempSync(join(tmpdir(), 'oxcrap-feature-elsewhere-'));
    this.#others.push(folder);
    return folder;
  }

  /** Runs the check with `args`, from `cwd` (the project folder by default). */
  runsTheCheck(args: string[], cwd = this.project): Run {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    });
    if (result.error) throw result.error;
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  }

  remember<K extends keyof Notes>(key: K, value: Notes[K]): void {
    this.#notes.set(key, value);
  }

  recall<K extends keyof Notes>(key: K): Notes[K] {
    if (!this.#notes.has(key)) throw new Error(`${this.name} doesn't remember a ${key}.`);
    return this.#notes.get(key) as Notes[K];
  }

  has(key: keyof Notes): boolean {
    return this.#notes.has(key);
  }

  exit(): void {
    for (const folder of [this.#folder, ...this.#others]) {
      if (folder) rmSync(folder, { recursive: true, force: true });
    }
  }
}
