import { describe, expect, it } from 'vitest';
import { receiptSeedSchema, validateSeed } from './receiptSeed';

const seed = {
  title: 'Taverna',
  cardTipEur: 0,
  cashTipEur: 0,
  bankUsd: 0,
  roster: [],
  items: [{ id: 'item-0', name: 'Taco (1/2)', en: 'Taco', eur: 5 }],
} as const;

describe('validateSeed', () => {
  it('rejects a seed that is not a JSON object', () => {
    expect(() => validateSeed(null)).toThrow('Seed must be a JSON object.');
  });

  it('rejects an array, which is an object to typeof but not a JSON object', () => {
    expect(() => validateSeed([seed])).toThrow('Seed must be a JSON object.');
  });

  it('reports indexed paths and duplicate ids', () => {
    const bad = { ...seed, items: [seed.items[0], { ...seed.items[0] }, { id: 'x', name: 1 }] };
    expect(() => validateSeed(bad)).toThrow(
      /items\[2\]\.name must be a string; items\[2\]\.en must be a string; items\[2\]\.eur must be a finite number; items\[1\]\.id "item-0" is duplicated/,
    );
  });

  it('rejects oversized payloads and non-finite amounts', () => {
    const many = Array.from({ length: 201 }, (_, i) => ({ ...seed.items[0], id: `item-${i}` }));
    expect(() => validateSeed({ ...seed, items: many })).toThrow(/items must have at most 200/);
    expect(() => validateSeed({ ...seed, bankUsd: Infinity })).toThrow(
      /bankUsd must be a finite number/,
    );
  });

  it('gives a frozen seed whose type is readonly at each level', () => {
    const parsed = validateSeed({ ...seed, roster: ['Ana'] });
    expect(() => {
      // @ts-expect-error The seed's fields are readonly.
      parsed.title = 'x';
    }).toThrow(TypeError);
    expect(() => {
      // @ts-expect-error Its roster is a readonly array.
      parsed.roster.push('Ben');
    }).toThrow(TypeError);
    expect(() => {
      // @ts-expect-error Its items are a readonly array.
      parsed.items.push(seed.items[0]);
    }).toThrow(TypeError);
    expect(() => {
      // @ts-expect-error Each item's fields are readonly.
      parsed.items[0].eur = 1;
    }).toThrow(TypeError);
  });

  it('describes the MCP tool input with no readOnly mark, which would tell a client not to send it', () => {
    const json = JSON.stringify(
      receiptSeedSchema['~standard'].jsonSchema.input({ target: 'draft-2020-12' }),
    );
    expect(json).toContain('"roster"');
    expect(json).not.toContain('readOnly');
  });

  // The input the tool served before its schemas were readonly, recorded from that schema (#69).
  // `.readonly()` must change nothing a client sees: no field, description or limit.
  it('serves the MCP tool the same input schema as before it was readonly', () => {
    expect(receiptSeedSchema['~standard'].jsonSchema.input({ target: 'draft-2020-12' }))
      .toMatchInlineSnapshot(`
      {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "properties": {
          "address": {
            "description": "Restaurant street address as printed on the receipt. Omit when not printed.",
            "maxLength": 200,
            "type": "string",
          },
          "bankUsd": {
            "description": "Bank/card charge in the display currency (USD when displayCurrency is omitted). Overrides rate when set. Use 0 when unknown.",
            "type": "number",
          },
          "cardTipEur": {
            "description": "Tip paid by card, in the receipt currency. Use 0 when unknown.",
            "type": "number",
          },
          "cashTipEur": {
            "description": "Tip paid in cash, in the receipt currency. Use 0 when unknown.",
            "type": "number",
          },
          "currency": {
            "description": "ISO 4217 code printed on the receipt (EUR, JPY, KWD, ...). Omitted means USD. Ask the user if it cannot be determined.",
            "type": "string",
          },
          "displayCurrency": {
            "description": "ISO 4217 code that participant shares are converted to. Only set when the user supplies it.",
            "type": "string",
          },
          "items": {
            "description": "Receipt lines in printed order. CRITICAL: unroll quantities > 1 into separate 1x entries at the unit price. Never add VAT, tax, discount or subtotal lines as items. The sum of eur must equal the printed total.",
            "items": {
              "properties": {
                "en": {
                  "description": "English translation or concise explanation; repeat the name for English receipts.",
                  "maxLength": 200,
                  "type": "string",
                },
                "eur": {
                  "description": "Price of a SINGLE unit in the receipt currency (field name is historical). Use numbers, not formatted strings.",
                  "type": "number",
                },
                "id": {
                  "description": "Sequential unique ID in printed order: item-0, item-1, ...",
                  "maxLength": 64,
                  "type": "string",
                },
                "name": {
                  "description": "Item text as printed on the receipt. Multi-quantity items are suffixed "(1/2)", "(2/2)".",
                  "maxLength": 200,
                  "type": "string",
                },
              },
              "required": [
                "id",
                "name",
                "en",
                "eur",
              ],
              "type": "object",
            },
            "maxItems": 200,
            "type": "array",
          },
          "mealType": {
            "description": "Short agent-inferred label for the occasion, e.g. "Dinner", "Birthday dinner", "Thanksgiving lunch". Omit when there is no basis for a guess.",
            "maxLength": 64,
            "type": "string",
          },
          "phone": {
            "description": "Restaurant phone number as printed. Omit when not printed.",
            "maxLength": 64,
            "type": "string",
          },
          "purchasedAt": {
            "description": "When the meal was paid, local time printed on the receipt: YYYY-MM-DDTHH:mm (or YYYY-MM-DD if no time). Omit when not printed.",
            "maxLength": 32,
            "type": "string",
          },
          "rate": {
            "description": "1 receipt-currency unit in the display currency. Never invent a rate; omit unless the user supplies one.",
            "exclusiveMinimum": 0,
            "type": "number",
          },
          "rateDate": {
            "description": "Date of the rate, YYYY-MM-DD.",
            "maxLength": 32,
            "type": "string",
          },
          "roster": {
            "description": "Participant names. Use [] when unknown.",
            "items": {
              "maxLength": 200,
              "type": "string",
            },
            "maxItems": 50,
            "type": "array",
          },
          "title": {
            "description": "Restaurant or receipt title. Use the merchant name, or "Receipt" if unknown.",
            "maxLength": 200,
            "type": "string",
          },
          "website": {
            "description": "Restaurant website or email as printed. Omit when not printed.",
            "maxLength": 200,
            "type": "string",
          },
        },
        "required": [
          "title",
          "cardTipEur",
          "cashTipEur",
          "bankUsd",
          "roster",
          "items",
        ],
        "type": "object",
      }
    `);
  });

  it('rejects an unknown currency and keeps a known one', () => {
    const base = { title: 't', cardTipEur: 0, cashTipEur: 0, bankUsd: 0, roster: [], items: [] };
    expect(() => validateSeed({ ...base, currency: 'XXXX' })).toThrow(/currency/);
    expect(validateSeed({ ...base, currency: 'KWD' }).currency).toBe('KWD');
  });
});
