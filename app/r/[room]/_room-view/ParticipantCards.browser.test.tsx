import { describe, expect, it } from 'vitest';
import { page, type Locator } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import {
  type RoomSnapshot,
  itemIdSchema,
  participantIdSchema,
} from '@/domain/receipt/roomSnapshot';
import { ParticipantCards } from './ParticipantCards';

const ryan = participantIdSchema.parse('p-ryan');
const jameson = participantIdSchema.parse('p-jameson');

// Ryan ate €100 and Jameson €37 of a €140 card payment (€3 card tip) with a €10 cash tip, and the
// bank charged $154: €1 = $1.1. Tips split by what each person ate.
const dinner: RoomSnapshot = {
  title: 'Dinner',
  address: '',
  phone: '',
  website: '',
  purchasedAt: '',
  mealType: '',
  cardTipEur: 3,
  cashTipEur: 10,
  bankUsd: 154,
  currency: 'EUR',
  displayCurrency: 'USD',
  rate: 0,
  rateDate: '',
  participants: [
    { id: ryan, name: 'Ryan', colorIdx: 0 },
    { id: jameson, name: 'Jameson', colorIdx: 1 },
  ],
  items: [
    {
      id: itemIdSchema.parse('item-0'),
      name: 'Meal A',
      en: '',
      eur: 100,
      order: 0,
      claims: { [ryan]: true },
    },
    {
      id: itemIdSchema.parse('item-1'),
      name: 'Meal B',
      en: '',
      eur: 37,
      order: 1,
      claims: { [jameson]: true },
    },
  ],
  connection: { provider: 'WebRTC', status: 'connected' },
  peers: [],
};

async function renderCards(snapshot: RoomSnapshot) {
  const screen = await render(<ParticipantCards snapshot={snapshot} />);
  const region = screen.getByRole('region', { name: 'Per-person totals' });
  function card(name: string) {
    return region.getByRole('article').filter({ has: page.getByRole('heading', { name }) });
  }
  return { region, card };
}

/** Each line a person reads on a card, as written. */
async function expectLines(card: Locator, lines: readonly string[]) {
  for (const line of lines) {
    await expect.element(card.getByText(line, { exact: true })).toBeVisible();
  }
}

describe('ParticipantCards', () => {
  it('shows what each person ate and owes, in the bank’s currency and the receipt’s', async () => {
    const { region, card } = await renderCards(dinner);
    await expectLines(card('Ryan'), ['Items €100.00 · tips €9.49', '$120.44', '€109.49']);
    await expectLines(card('Jameson'), ['Items €37.00 · tips €3.51', '$44.56', '€40.51']);
    await expect
      .element(region.getByText('Rate: 1 EUR = 1.1000 USD · based on bank charge'))
      .toBeVisible();
  });

  it('marks totals at an estimated rate, with the rate’s date', async () => {
    const { region, card } = await renderCards({
      ...dinner,
      bankUsd: 0,
      rate: 1.2,
      rateDate: '2026-03-06',
    });
    await expectLines(card('Ryan'), ['$131.39 est.', '€109.49']);
    await expect
      .element(region.getByText('Rate: 1 EUR = 1.2000 USD · rate of 2026-03-06'))
      .toBeVisible();
  });

  it('tells screen readers there are no participants while there are none', async () => {
    const { region } = await renderCards({ ...dinner, participants: [] });
    await expect.element(region.getByText('No participants yet.')).toBeInTheDocument();
  });

  it('says nothing of participants once there are some', async () => {
    const { region } = await renderCards(dinner);
    await expect.element(region.getByText('No participants yet.')).not.toBeInTheDocument();
  });

  it('says the date of an estimated rate is unknown when the receipt has none', async () => {
    const { region } = await renderCards({ ...dinner, bankUsd: 0, rate: 1.2, rateDate: '' });
    await expect
      .element(region.getByText('Rate: 1 EUR = 1.2000 USD · rate of unknown date'))
      .toBeVisible();
  });

  it('shows totals in the receipt’s currency only, and no rate, when there is nothing to convert to', async () => {
    const { region, card } = await renderCards({ ...dinner, bankUsd: 0, displayCurrency: '' });
    await expectLines(card('Ryan'), ['Items €100.00 · tips €9.49', '€109.49']);
    await expect.element(card('Ryan').getByText('$', { exact: false })).not.toBeInTheDocument();
    await expect.element(region.getByText(/^Rate:/)).not.toBeInTheDocument();
  });
});
