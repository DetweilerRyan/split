import { z } from 'zod';
import { isValidCurrency } from '../utils/currency';

export const MAX_ITEMS = 200;
export const MAX_ROSTER = 50;
export const MAX_TEXT = 200;

// Every `error` below is a suffix; formatSeedIssues prepends the field path.
const text = (max = MAX_TEXT) =>
  z.string({ error: 'must be a string' }).max(max, { error: `must be at most ${max} characters` });
const amount = z.number({ error: 'must be a finite number' });
const currencyCode = z
  .string({ error: 'must be an ISO 4217 currency code' })
  .refine(isValidCurrency, { error: 'must be an ISO 4217 currency code' });

/**
 * Single source of truth for the receipt seed: validates ingest links and
 * is the input schema (with descriptions) of the MCP `create_receipt_room` tool.
 */
export const receiptSeedSchema = z.object({
  title: text().describe('Restaurant or receipt title. Use the merchant name, or "Receipt" if unknown.'),
  address: text().optional().describe('Restaurant street address as printed on the receipt. Omit when not printed.'),
  phone: text(64).optional().describe('Restaurant phone number as printed. Omit when not printed.'),
  website: text().optional().describe('Restaurant website or email as printed. Omit when not printed.'),
  purchasedAt: text(32)
    .optional()
    .describe('When the meal was paid, local time printed on the receipt: YYYY-MM-DDTHH:mm (or YYYY-MM-DD if no time). Omit when not printed.'),
  cardTipEur: amount.describe('Tip paid by card, in the receipt currency. Use 0 when unknown.'),
  cashTipEur: amount.describe('Tip paid in cash, in the receipt currency. Use 0 when unknown.'),
  bankUsd: amount.describe(
    'Bank/card charge in the display currency (USD when displayCurrency is omitted). Overrides rate when set. Use 0 when unknown.',
  ),
  currency: currencyCode
    .optional()
    .describe('ISO 4217 code printed on the receipt (EUR, JPY, KWD, ...). Omitted means USD. Ask the user if it cannot be determined.'),
  displayCurrency: currencyCode
    .optional()
    .describe('ISO 4217 code that participant shares are converted to. Only set when the user supplies it.'),
  rate: z
    .number({ error: 'must be a positive number' })
    .positive({ error: 'must be a positive number' })
    .optional()
    .describe('1 receipt-currency unit in the display currency. Never invent a rate; omit unless the user supplies one.'),
  rateDate: text(32).optional().describe('Date of the rate, YYYY-MM-DD.'),
  roster: z
    .array(text(), { error: 'must be an array of strings' })
    .max(MAX_ROSTER, { error: `must have at most ${MAX_ROSTER} entries` })
    .describe('Participant names. Use [] when unknown.'),
  items: z
    .array(
      z.object(
        {
          id: text(64).describe('Sequential unique ID in printed order: item-0, item-1, ...'),
          name: text().describe('Item text as printed on the receipt. Multi-quantity items are suffixed "(1/2)", "(2/2)".'),
          en: text().describe('English translation or concise explanation; repeat the name for English receipts.'),
          eur: amount.describe(
            'Price of a SINGLE unit in the receipt currency (field name is historical). Use numbers, not formatted strings.',
          ),
        },
        { error: 'must be an object' },
      ),
      { error: 'must be an array' },
    )
    .max(MAX_ITEMS, { error: `must have at most ${MAX_ITEMS} entries` })
    .describe(
      'Receipt lines in printed order. CRITICAL: unroll quantities > 1 into separate 1x entries at the unit price. Never add VAT, tax, discount or subtotal lines as items. The sum of eur must equal the printed total.',
    )
    // `when` keeps this running alongside per-item type errors, as the old validator did.
    .check(
      z.superRefine((items, ctx) => {
        if (!Array.isArray(items)) return;
        const seen = new Set<string>();
        items.forEach((item, index) => {
          const id = (item as { id?: unknown } | null)?.id;
          if (typeof id !== 'string') return;
          if (seen.has(id)) ctx.addIssue({ code: 'custom', path: [index, 'id'], message: `"${id}" is duplicated` });
          seen.add(id);
        });
      }, { when: () => true }),
    ),
});

export type ReceiptSeed = z.infer<typeof receiptSeedSchema>;

export function formatSeedIssues(issues: readonly z.core.$ZodIssue[]): string[] {
  const messages = issues.map((issue) => {
    const path = issue.path.reduce<string>(
      (acc, key) => (typeof key === 'number' ? `${acc}[${key}]` : acc ? `${acc}.${String(key)}` : String(key)),
      '',
    );
    return `${path} ${issue.message}`;
  });
  return [...new Set(messages)];
}
