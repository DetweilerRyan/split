import { devices, type Browser, type Page } from '@playwright/test';
import type { ReceiptSeed } from '../../src/store/seedCodec';
import { connectToMcpServer, type McpSession, type ToolResult } from './mcp';

/** Something an actor does, made of interactions with the abilities the actor has. */
export type Task = (actor: Actor) => Promise<void>;
/** Something an actor finds out. A question that returns a Locator lets `expect` retry it. */
export type Question<T> = (actor: Actor) => T;

/** What an actor can remember between steps. */
export interface Notes {
  receipt: ReceiptSeed;
  toolResult: ToolResult;
}

// SplitSmart is designed for phones first, so every actor browses on one.
const phone = { ...devices['Pixel 7'], locale: 'en-US' };

function isLocal(url: URL): boolean {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

/**
 * A person or assistant in a scenario. Each actor gets abilities as they first need them:
 * a browser of their own (a separate context, so separate storage and identity) and an MCP
 * client session.
 */
export class Actor {
  #page: Page | undefined;
  #mcp: McpSession | undefined;
  readonly #notes = new Map<keyof Notes, Notes[keyof Notes]>();

  constructor(
    readonly name: string,
    private readonly browser: Browser,
    private readonly baseURL: string,
  ) {}

  async attemptsTo(...tasks: Task[]): Promise<void> {
    for (const task of tasks) await task(this);
  }

  answer<T>(question: Question<T>): T {
    return question(this);
  }

  async browseTheWeb(): Promise<Page> {
    if (!this.#page) {
      const context = await this.browser.newContext({ ...phone, baseURL: this.baseURL });
      // Tests stay offline: anything not served by this machine, such as web fonts, is refused.
      await context.route(
        (url) => !isLocal(url),
        (route) => route.abort('blockedbyclient'),
      );
      this.#page = await context.newPage();
    }
    return this.#page;
  }

  /** The browser page, for questions; throws if the actor never opened one. */
  get page(): Page {
    if (!this.#page) throw new Error(`${this.name} has not opened a browser yet.`);
    return this.#page;
  }

  async useMcpServer(): Promise<McpSession> {
    this.#mcp ??= await connectToMcpServer(new URL('/api/mcp', this.baseURL));
    return this.#mcp;
  }

  remember<K extends keyof Notes>(key: K, value: Notes[K]): void {
    this.#notes.set(key, value);
  }

  recall<K extends keyof Notes>(key: K): Notes[K] {
    if (!this.#notes.has(key)) throw new Error(`${this.name} doesn't remember a ${key}.`);
    return this.#notes.get(key) as Notes[K];
  }

  async exit(): Promise<void> {
    await this.#mcp?.close();
    await this.#page?.context().close();
  }
}
