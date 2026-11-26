import { expect, type Locator } from '@playwright/test';
import type { Actor, Task } from './actor';
import { ConnectionStatus, ItemRow, RoomLinkFrom } from './questions';

/** Calls the MCP server's create_receipt_room tool with the receipt the actor remembers. */
export async function CreateReceiptRoom(actor: Actor): Promise<void> {
  const mcp = await actor.useMcpServer();
  const result = await mcp.callTool({
    name: 'create_receipt_room',
    arguments: { ...actor.recall('receipt') },
  });
  actor.remember('toolResult', result);
}

/** Opens the link another actor's tool call returned, and waits for the room to load. */
export function OpenRoomLinkFrom(assistant: Actor): Task {
  return async (actor) => {
    const page = await actor.browseTheWeb();
    await page.goto(actor.answer(RoomLinkFrom(assistant)));
    await page.waitForURL(/\/r\/[^/]+$/);
  };
}

/** Opens the room another actor is in, as if they had shared its link, and waits to connect. */
export function JoinRoomOf(host: Actor): Task {
  return async (actor) => {
    const page = await actor.browseTheWeb();
    await page.goto(host.page.url());
    await expect(actor.answer(ConnectionStatus)).toHaveAccessibleName(/connected, 2 connections/);
    await expect(host.answer(ConnectionStatus)).toHaveAccessibleName(/connected, 2 connections/);
  };
}

/** A window the room opens over itself, in the words of the people at the table. */
export type RoomWindow = 'share' | 'restaurant details' | "who's at the table" | 'receipt presets';

export function isRoomWindow(name: string): name is RoomWindow {
  return (
    name === 'share' ||
    name === 'restaurant details' ||
    name === "who's at the table" ||
    name === 'receipt presets'
  );
}

/** The control that opens a window for `actor`, and the window's name once it's open. */
function controls(
  window: RoomWindow,
  actor: Actor,
): { readonly opener: Locator; readonly title: RegExp } {
  const header = actor.page.getByRole('banner');
  switch (window) {
    case 'share':
      return {
        opener: header.getByRole('button', { name: 'Share', exact: true }),
        title: /^Share this room$/,
      };
    case 'restaurant details':
      return {
        opener: header.getByRole('button', { name: /\(restaurant details\)$/ }),
        title: /.+/,
      };
    case "who's at the table":
      // The header names whoever the room knows you as, or asks who you are.
      return {
        opener: header.getByRole('button', {
          name: new RegExp(`^(${actor.name}|Who are you\\?)$`),
        }),
        title: /^Who are you on this bill\?$/,
      };
    case 'receipt presets':
      return {
        opener: actor.page.getByRole('button', { name: 'Seed / presets', exact: true }),
        title: /^Seed and receipt presets$/,
      };
    default: {
      const unhandled: never = window;
      return unhandled;
    }
  }
}

/** Opens one of the room's windows, and waits until it's showing. */
export function OpenWindow(window: RoomWindow): Task {
  return async (actor) => {
    const { opener, title } = controls(window, actor);
    await opener.click();
    await expect(actor.page.getByRole('dialog', { name: title })).toBeVisible();
  };
}

/** Taps the actor's own name on an item, which claims it for them. */
export function Claim(item: string): Task {
  return async (actor) => {
    await actor
      .answer(ItemRow(item))
      .getByRole('button', { name: actor.name, exact: true })
      .click();
  };
}
