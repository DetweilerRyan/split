import { expect } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { Given, Then, When } from '../screenplay/fixtures';
import {
  ItemRow,
  ReceiptTitle,
  ToolCallFailed,
  ToolResultText,
  TotalsFor,
} from '../screenplay/questions';
import { Claim, CreateReceiptRoom, JoinRoomOf, OpenRoomLinkFrom } from '../screenplay/tasks';

Given(
  '{word} has read a receipt from {string} for {string} and {string}:',
  (
    { actorCalled },
    assistant: string,
    title: string,
    first: string,
    second: string,
    table: DataTable,
  ) => {
    actorCalled(assistant).remember('receipt', {
      title,
      cardTipEur: 0,
      cashTipEur: 0,
      bankUsd: 0,
      roster: [first, second],
      items: table.hashes().map(({ item, price }, index) => {
        if (item === undefined || price === undefined) {
          throw new Error('The receipt table needs an "item" and a "price" column.');
        }
        return { id: `item-${index}`, name: item, en: item, eur: Number(price) };
      }),
    });
  },
);

Given(
  '{word} gave {string} the same id as {string}',
  ({ actorCalled }, assistant: string, copy: string, original: string) => {
    const actor = actorCalled(assistant);
    const receipt = actor.recall('receipt');
    const id = receipt.items.find((item) => item.name === original)?.id;
    if (id === undefined) throw new Error(`The receipt has no "${original}".`);
    actor.remember('receipt', {
      ...receipt,
      items: receipt.items.map((item) => (item.name === copy ? { ...item, id } : item)),
    });
  },
);

Given(
  /^(\w+) (?:gave|gives) "([^"]*)" the id "([^"]*)"$/,
  ({ actorCalled }, assistant: string, name: string, id: string) => {
    const actor = actorCalled(assistant);
    const receipt = actor.recall('receipt');
    if (!receipt.items.some((item) => item.name === name)) {
      throw new Error(`The receipt has no "${name}".`);
    }
    actor.remember('receipt', {
      ...receipt,
      items: receipt.items.map((item) => (item.name === name ? { ...item, id } : item)),
    });
  },
);

When(
  /^(\w+) (?:creates|has created) a receipt room$/,
  async ({ actorCalled }, assistant: string) => {
    await actorCalled(assistant).attemptsTo(CreateReceiptRoom);
  },
);

When(
  /^(\w+) (?:opens|has opened) the room link (\w+) was given$/,
  async ({ actorCalled }, person: string, assistant: string) => {
    await actorCalled(person).attemptsTo(OpenRoomLinkFrom(actorCalled(assistant)));
  },
);

Given("{word} has joined {word}'s room", async ({ actorCalled }, person: string, host: string) => {
  await actorCalled(person).attemptsTo(JoinRoomOf(actorCalled(host)));
});

When('{word} claims {string}', async ({ actorCalled }, person: string, item: string) => {
  await actorCalled(person).attemptsTo(Claim(item));
});

Then(
  '{word} sees the receipt titled {string}',
  async ({ actorCalled }, person: string, title: string) => {
    await expect(actorCalled(person).answer(ReceiptTitle(title))).toBeVisible();
  },
);

Then(
  '{word} sees {string} priced at {string} and unclaimed',
  async ({ actorCalled }, person: string, item: string, price: string) => {
    const row = actorCalled(person).answer(ItemRow(item));
    await expect(row).toContainText(price);
    await expect(row).toContainText('Unclaimed');
  },
);

Then(
  '{word} sees {string} claimed by one person',
  async ({ actorCalled }, person: string, item: string) => {
    await expect(actorCalled(person).answer(ItemRow(item))).toContainText('Solo');
  },
);

Then(
  '{word} sees {string} split at {string}',
  async ({ actorCalled }, person: string, item: string, share: string) => {
    await expect(actorCalled(person).answer(ItemRow(item))).toContainText(share);
  },
);

Then(
  '{word} sees that {word} owes {string}',
  async ({ actorCalled }, person: string, owner: string, amount: string) => {
    await expect(actorCalled(person).answer(TotalsFor(owner))).toContainText(amount);
  },
);

Then(
  '{word} is told the receipt is invalid because {string}',
  ({ actorCalled }, assistant: string, reason: string) => {
    const actor = actorCalled(assistant);
    expect(actor.answer(ToolCallFailed(actor))).toBe(true);
    expect(actor.answer(ToolResultText(actor))).toContain(reason);
  },
);
