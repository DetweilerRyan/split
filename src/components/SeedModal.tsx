import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { PRESETS } from '../data/presets';
import type { ReceiptSeed } from '../types/receipt';
import { decodeSeed } from '../store/seedCodec';

interface SeedModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (seed: ReceiptSeed, forceReset: boolean) => void;
  onPreset: (seed: ReceiptSeed) => void;
  onBlankRoom: () => void;
}

export function SeedModal({ open, onClose, onImport, onPreset, onBlankRoom }: SeedModalProps) {
  const [text, setText] = useState('');
  const [forceReset, setForceReset] = useState(true);
  if (!open) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onImportText();
  }

  function onImportText() {
    try {
      const input = text.trim();
      const urlParams = new URLSearchParams(input.includes('#') ? input.slice(input.indexOf('#') + 1) : input);
      const seed = decodeSeed(urlParams.get('seed') ?? input);
      if (!seed || !Array.isArray(seed.items)) throw new Error('Invalid seed');
      onImport(seed, forceReset);
    } catch {
      window.alert('Could not parse seed JSON, compressed seed, or room link.');
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal-card max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="seed-title" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 id="seed-title" className="text-lg font-extrabold">Seed and receipt presets</h2>
            <p className="text-xs text-slate-500">Share a compressed receipt seed or load a preset.</p>
          </div>
          <button aria-label="Close seed dialog" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="my-4 space-y-2">
          {Object.entries(PRESETS).map(([key, seed]) => (
            <button key={key} className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-indigo-400 hover:bg-indigo-50" onClick={() => onPreset(seed)}>
              <span className="block text-sm font-bold">{seed.title}</span>
              <span className="text-xs text-slate-500">{seed.items.length} receipt items</span>
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3 border-t border-slate-100 pt-4">
          <label className="field-label">Paste seed JSON, compressed seed, or share link
            <textarea className="input min-h-32 font-mono text-xs" value={text} onChange={(event) => setText(event.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={forceReset} onChange={(event) => setForceReset(event.target.checked)} />
            Replace current receipt when importing
          </label>
          <div className="flex justify-between">
            <button className="text-sm font-bold text-rose-700" type="button" onClick={onBlankRoom}>New blank room</button>
            <button className="button-primary" type="submit">Import seed</button>
          </div>
        </form>
      </section>
    </div>
  );
}
