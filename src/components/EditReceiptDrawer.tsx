import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import type { RoomSnapshot } from '../types/receipt';

interface EditReceiptDrawerProps {
  snapshot: RoomSnapshot;
  onMeta: (key: 'title' | 'cardTipEur' | 'cashTipEur' | 'bankUsd', value: string | number) => void;
  onAddItem: (name: string, en: string, eur: number) => void;
}

export function EditReceiptDrawer({ snapshot, onMeta, onAddItem }: EditReceiptDrawerProps) {
  const [name, setName] = useState('');
  const [english, setEnglish] = useState('');
  const [price, setPrice] = useState('');

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
        <label className="field-label">Bank charge (USD)
          <input className="input" type="number" step="0.01" value={snapshot.bankUsd || ''} onChange={(event) => onMeta('bankUsd', Number(event.target.value) || 0)} />
        </label>
        <label className="field-label">Card tip (EUR)
          <input className="input" type="number" step="0.01" value={snapshot.cardTipEur} onChange={(event) => onMeta('cardTipEur', Number(event.target.value) || 0)} />
        </label>
        <label className="field-label">Cash tip (EUR)
          <input className="input" type="number" step="0.01" value={snapshot.cashTipEur} onChange={(event) => onMeta('cashTipEur', Number(event.target.value) || 0)} />
        </label>
      </div>
      <form className="grid gap-2 sm:grid-cols-[1fr_1fr_8rem_auto]" onSubmit={submit}>
        <input aria-label="New item name" className="input" placeholder="Item name" value={name} onChange={(event) => setName(event.target.value)} />
        <input aria-label="English translation" className="input" placeholder="English translation" value={english} onChange={(event) => setEnglish(event.target.value)} />
        <input aria-label="New item price" className="input" type="number" min="0" step="0.01" placeholder="EUR" value={price} onChange={(event) => setPrice(event.target.value)} />
        <button className="button-primary justify-center" type="submit"><Plus size={15} /> Add</button>
      </form>
    </section>
  );
}
