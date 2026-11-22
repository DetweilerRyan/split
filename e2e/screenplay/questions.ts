import type { Locator } from '@playwright/test';
import type { Actor, Question } from './actor';

const linkPattern = /https?:\/\/\S+/;

/** The text an MCP tool call returned to an actor. */
export const ToolResultText =
  (assistant: Actor): Question<string> =>
  () => {
    const { content } = assistant.recall('toolResult');
    return content.map((part) => (part.type === 'text' ? part.text : '')).join('\n');
  };

/** Whether the server reported the actor's last tool call as failed. */
export const ToolCallFailed =
  (assistant: Actor): Question<boolean> =>
  () =>
    assistant.recall('toolResult').isError === true;

/** The room link in the text an actor's tool call returned. */
export const RoomLinkFrom =
  (assistant: Actor): Question<string> =>
  (actor) => {
    const link = linkPattern.exec(actor.answer(ToolResultText(assistant)))?.[0];
    if (!link) throw new Error(`${assistant.name}'s tool result holds no link.`);
    return link;
  };

/** The badge in the header that says how the room is connected and to how many people. */
export const ConnectionStatus: Question<Locator> = ({ page }) =>
  page.getByRole('banner').getByRole('status');

/** One line of the receipt, by the item's name. */
export const ItemRow =
  (item: string): Question<Locator> =>
  ({ page }) =>
    page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Receipt items' }) })
      .getByRole('article')
      .filter({ has: page.getByText(item, { exact: true }) });

/** One person's card under "Per-person totals". */
export const TotalsFor =
  (person: string): Question<Locator> =>
  ({ page }) =>
    page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Per-person totals' }) })
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: person, exact: true }) });

/** The receipt's title, as the room shows it. */
export const ReceiptTitle =
  (title: string): Question<Locator> =>
  ({ page }) =>
    page.getByRole('heading', { name: title, exact: true });
