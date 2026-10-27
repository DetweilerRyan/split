import type { ReceiptSeed } from '../types/receipt';

export const PICASSO_SEED: ReceiptSeed = {
  title: 'Pizzeria Picasso (Split)',
  cardTipEur: 0,
  cashTipEur: 0,
  bankUsd: 0,
  roster: ['Ryan', 'Jameson'],
  items: [
    { id: 'item-0', name: 'STRANI TONIK 0,20', en: 'Imported Tonic Water (200ml)', eur: 6 },
    { id: 'item-1', name: 'GRIMBERGEN BLONDE', en: 'Grimbergen Blonde Belgian Ale', eur: 6 },
    { id: 'item-2', name: 'SYRAH 0,125', en: 'Glass of Syrah Red Wine (125ml)', eur: 7 },
    { id: 'item-3', name: 'VODA 0,75', en: 'Bottled Water (750ml)', eur: 6 },
    { id: 'item-4', name: 'MEDITERRANEAN MAST', en: 'Mediterranean Masterpiece Pizza', eur: 17 },
    { id: 'item-5', name: 'PICASSO PROSCIUTTO', en: 'Picasso Prosciutto Pizza', eur: 19 },
    { id: 'item-6', name: 'VIVA LA VEGGIE', en: 'Viva La Veggie Vegetarian Pizza', eur: 14 },
    { id: 'item-7', name: 'BRESAOLA GOURMET', en: 'Bresaola Gourmet Pizza (Cured Beef)', eur: 18 },
    { id: 'item-8', name: 'ŠKAMPI', en: 'Scampi / Prawns Topping Add-on', eur: 4 },
    { id: 'item-9', name: 'EL JIMADOR BLANCO (1/2)', en: 'El Jimador Blanco Tequila Shot', eur: 4.5 },
    { id: 'item-10', name: 'EL JIMADOR BLANCO (2/2)', en: 'El Jimador Blanco Tequila Shot', eur: 4.5 },
    { id: 'item-11', name: 'GRIMBERGEN BLONDE (1/2)', en: 'Grimbergen Blonde Belgian Ale (Round 2)', eur: 6 },
    { id: 'item-12', name: 'GRIMBERGEN BLONDE (2/2)', en: 'Grimbergen Blonde Belgian Ale (Round 2)', eur: 6 },
    { id: 'item-13', name: 'SYRAH 0,125', en: 'Glass of Syrah Red Wine (125ml - Round 2)', eur: 7 },
    { id: 'item-14', name: 'GRIMBERGEN BLONDE (1/2)', en: 'Grimbergen Blonde Belgian Ale (Round 3)', eur: 6 },
    { id: 'item-15', name: 'GRIMBERGEN BLONDE (2/2)', en: 'Grimbergen Blonde Belgian Ale (Round 3)', eur: 6 },
  ],
};

export const PRESETS: Record<string, ReceiptSeed> = {
  picasso: PICASSO_SEED,
  plitvice: {
    title: 'Konoba Lička Kuća — Plitvice',
    cardTipEur: 0,
    cashTipEur: 12,
    bankUsd: 147.56,
    roster: ['Jameson', 'Ryan', 'Sarah', 'Elena'],
    items: [
      { id: 'item-0', name: 'Domaća šljivovica', en: 'Homemade Plum Brandy', eur: 7 },
      { id: 'item-1', name: 'Lička basa i domaća pogača', en: 'Traditional Soft Cheese & Warm Bread', eur: 9.5 },
      { id: 'item-2', name: 'Janjetina ispod peke', en: 'Slow-Roasted Lamb Under the Iron Bell', eur: 48 },
      { id: 'item-3', name: 'Crni rižoto od sipe', en: 'Adriatic Cuttlefish Black Risotto', eur: 19.5 },
    ],
  },
  osteria: {
    title: 'Trattoria da Enzo al 29 — Roma',
    cardTipEur: 5,
    cashTipEur: 8,
    bankUsd: 121.52,
    roster: ['Jameson', 'Ryan', 'Sarah'],
    items: [
      { id: 'item-0', name: 'Coperto Pane e Servizio', en: 'Table Bread & Cover Charge', eur: 7.5 },
      { id: 'item-1', name: 'Carciofi alla Giudia', en: 'Crispy Roman Fried Artichokes', eur: 14 },
      { id: 'item-2', name: 'Tonnarelli Cacio e Pepe', en: 'Fresh Pasta with Pecorino & Black Pepper', eur: 16.5 },
      { id: 'item-3', name: 'Rigatoni alla Carbonara', en: 'Rigatoni with Guanciale & Pecorino', eur: 17 },
    ],
  },
};
