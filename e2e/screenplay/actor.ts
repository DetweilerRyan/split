import { devices, type Browser, type Page } from '@playwright/test';
import type { ReceiptSeed } from '../../src/sync/seedCodec';
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
export interface Actor {
  readonly name: string;
  readonly attemptsTo: (...tasks: Task[]) => Promise<void>;
  readonly answer: <T>(question: Question<T>) => T;
  readonly browseTheWeb: () => Promise<Page>;
  /** The browser page, for questions; throws if the actor never opened one. */
  readonly page: Page;
  readonly useMcpServer: () => Promise<McpSession>;
  readonly remember: <K extends keyof Notes>(key: K, value: Notes[K]) => void;
  readonly recall: <K extends keyof Notes>(key: K) => Notes[K];
  readonly exit: () => Promise<void>;
}

/** A new actor called `name`, who browses `baseURL` in a context of their own on `browser`. */
export function createActor(name: string, browser: Browser, baseURL: string): Actor {
  let page: Page | undefined;
  let mcp: McpSession | undefined;
  const notes = new Map<keyof Notes, Notes[keyof Notes]>();

  async function attemptsTo(...tasks: Task[]): Promise<void> {
    for (const task of tasks) await task(actor);
  }

  function answer<T>(question: Question<T>): T {
    return question(actor);
  }

  async function browseTheWeb(): Promise<Page> {
    if (!page) {
      const context = await browser.newContext({ ...phone, baseURL });
      // Tests stay offline: anything not served by this machine, such as web fonts, is refused.
      await context.route(
        (url) => !isLocal(url),
        (route) => route.abort('blockedbyclient'),
      );
      page = await context.newPage();
    }
    return page;
  }

  function openedPage(): Page {
    if (!page) throw new Error(`${name} has not opened a browser yet.`);
    return page;
  }

  async function useMcpServer(): Promise<McpSession> {
    mcp ??= await connectToMcpServer(new URL('/api/mcp', baseURL));
    return mcp;
  }

  function remember<K extends keyof Notes>(key: K, value: Notes[K]): void {
    notes.set(key, value);
  }

  function recall<K extends keyof Notes>(key: K): Notes[K] {
    if (!notes.has(key)) throw new Error(`${name} doesn't remember a ${key}.`);
    return notes.get(key) as Notes[K];
  }

  async function exit(): Promise<void> {
    await mcp?.close();
    await page?.context().close();
  }

  const actor: Actor = {
    name,
    attemptsTo,
    answer,
    browseTheWeb,
    get page() {
      return openedPage();
    },
    useMcpServer,
    remember,
    recall,
    exit,
  };
  return actor;
}
