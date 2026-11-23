import { expect } from '@playwright/test';
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

/** Taps the actor's own name on an item, which claims it for them. */
export function Claim(item: string): Task {
  return async (actor) => {
    await actor
      .answer(ItemRow(item))
      .getByRole('button', { name: actor.name, exact: true })
      .click();
  };
}
