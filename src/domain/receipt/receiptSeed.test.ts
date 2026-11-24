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

  it('rejects an unknown currency and keeps a known one', () => {
    const base = { title: 't', cardTipEur: 0, cashTipEur: 0, bankUsd: 0, roster: [], items: [] };
    expect(() => validateSeed({ ...base, currency: 'XXXX' })).toThrow(/currency/);
    expect(validateSeed({ ...base, currency: 'KWD' }).currency).toBe('KWD');
  });
});
