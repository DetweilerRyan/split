import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import type { RoomSnapshot } from '../types/receipt';
import { currencyExponent, currencyLabel, listCurrencies } from '../utils/currency';

interface EditReceiptDrawerProps {
  snapshot: RoomSnapshot;
  onMeta: (key: 'title' | 'cardTipEur' | 'cashTipEur' | 'bankUsd', value: string | number) => void;
  onCurrency: (code: string) => void;
  onDisplayCurrency: (code: string, force?: boolean) => void;
  onRate: (rate: number) => void;
  onAddItem: (name: string, en: string, eur: number) => void;
}

export function EditReceiptDrawer({ snapshot, onMeta, onCurrency, onDisplayCurrency, onRate, onAddItem }: EditReceiptDrawerProps) {
  const [name, setName] = useState('');
  const [english, setEnglish] = useState('');
  const [price, setPrice] = useState('');

  const currencies = listCurrencies();
  const step = 10 ** -currencyExponent(snapshot.currency);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    onAddItem(name.trim(), english.trim(), Number(price) || 0);
    setName('');
    setEnglish('');
    setPrice('');
  }

  return (
    <section className="card space-y-4 border-amber-300 bg-amber-50/70 p-4">
      <h2 className="font-extrabold text-amber-950">Edit receipt and bank reconciliation</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field-label">Receipt title
          <input className="input" value={snapshot.title} onChange={(event) => onMeta('title', event.target.value)} />
        </label>
        <label className="field-label">Receipt currency
          <select className="input" value={snapshot.currency} onChange={(event) => onCurrency(event.target.value)}>
            {(currencies.includes(snapshot.currency) ? currencies : [snapshot.currency, ...currencies]).map((code) => (
              <option key={code} value={code}>{currencyLabel(code)}</option>
            ))}
          </select>
        </label>
        <label className="field-label">Convert shares to (optional)
          <select className="input" value={snapshot.displayCurrency} onChange={(event) => onDisplayCurrency(event.target.value)}>
            <option value="">None</option>
            {currencies.filter((code) => code !== snapshot.currency).map((code) => (
              <option key={code} value={code}>{currencyLabel(code)}</option>
            ))}
          </select>
        </label>
        {snapshot.displayCurrency && (
          <label className="field-label">Rate (1 {snapshot.currency} = ? {snapshot.displayCurrency}){snapshot.rateDate ? ` · ${snapshot.rateDate}` : ''}
            <span className="flex gap-2">
              <input className="input" type="number" min="0" step="any" value={snapshot.rate || ''} onChange={(event) => onRate(Number(event.target.value) || 0)} />
              <button className="button-secondary" type="button" onClick={() => onDisplayCurrency(snapshot.displayCurrency, true)}>Refresh</button>
            </span>
          </label>
        )}
        <label className="field-label">Bank charge (display currency)
          <input className="input" type="number" step="0.01" value={snapshot.bankUsd || ''} onChange={(event) => onMeta('bankUsd', Number(event.target.value) || 0)} />
        </label>
        <label className="field-label">Card tip ({snapshot.currency})
          <input className="input" type="number" step={step} value={snapshot.cardTipEur} onChange={(event) => onMeta('cardTipEur', Number(event.target.value) || 0)} />
        </label>
        <label className="field-label">Cash tip ({snapshot.currency})
          <input className="input" type="number" step={step} value={snapshot.cashTipEur} onChange={(event) => onMeta('cashTipEur', Number(event.target.value) || 0)} />
        </label>
      </div>
      <form className="grid gap-2 sm:grid-cols-[1fr_1fr_8rem_auto]" onSubmit={submit}>
        <input aria-label="New item name" className="input" placeholder="Item name" value={name} onChange={(event) => setName(event.target.value)} />
        <input aria-label="English translation" className="input" placeholder="English translation" value={english} onChange={(event) => setEnglish(event.target.value)} />
        <input aria-label="New item price" className="input" type="number" min="0" step={step} placeholder={snapshot.currency} value={price} onChange={(event) => setPrice(event.target.value)} />
        <button className="button-primary justify-center" type="submit"><Plus size={15} /> Add</button>
      </form>
    </section>
  );
}
