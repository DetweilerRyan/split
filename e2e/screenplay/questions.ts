import type { Locator } from '@playwright/test';
import { type Scan, scanForBarriers } from './accessibility';
import type { Actor, Question } from './actor';

const linkPattern = /https?:\/\/\S+/;

/** The text an MCP tool call returned to an actor. */
export function ToolResultText(assistant: Actor): Question<string> {
  return () => {
    const { content } = assistant.recall('toolResult');
    return content.map((part) => (part.type === 'text' ? part.text : '')).join('\n');
  };
}

/** Whether the server reported the actor's last tool call as failed. */
export function ToolCallFailed(assistant: Actor): Question<boolean> {
  return () => assistant.recall('toolResult').isError === true;
}

/** The room link in the text an actor's tool call returned. */
export function RoomLinkFrom(assistant: Actor): Question<string> {
  return (actor) => {
    const link = linkPattern.exec(actor.answer(ToolResultText(assistant)))?.[0];
    if (link === undefined) throw new Error(`${assistant.name}'s tool result holds no link.`);
    return link;
  };
}

/** The badge in the header that says how the room is connected and to how many people. */
export function ConnectionStatus({ page }: Actor): Locator {
  return page.getByRole('banner').getByRole('status');
}

/** One line of the receipt, by the item's name. */
export function ItemRow(item: string): Question<Locator> {
  return ({ page }) =>
    page
      .getByRole('region', { name: 'Receipt items' })
      .getByRole('article')
      .filter({ has: page.getByText(item, { exact: true }) });
}

/** One person's card under "Per-person totals". */
export function TotalsFor(person: string): Question<Locator> {
  return ({ page }) =>
    page
      .getByRole('region', { name: 'Per-person totals' })
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: person, exact: true }) });
}

/** The receipt's title, as the room shows it. */
export function ReceiptTitle(title: string): Question<Locator> {
  return ({ page }) => page.getByRole('heading', { name: title, exact: true });
}

/** The accessibility barriers an automated check finds in what the actor sees now. */
export function BarriersOnScreen({ page }: Actor): Promise<Scan> {
  return scanForBarriers(page);
}
