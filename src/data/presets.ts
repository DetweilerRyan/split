import type { ReceiptSeed } from '../types/receipt';

export const PRESETS: Record<string, ReceiptSeed> = {
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
