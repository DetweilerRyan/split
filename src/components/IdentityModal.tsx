import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { Participant } from '../types/receipt';

interface IdentityModalProps {
  open: boolean;
  participants: readonly Participant[];
  activeId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}

export function IdentityModal({
  open,
  participants,
  activeId,
  onClose,
  onSelect,
  onAdd,
  onRemove,
}: IdentityModalProps) {
  const [name, setName] = useState('');
  if (!open) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    onAdd(name);
    setName('');
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="identity-title" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Live P2P session</p>
            <h2 id="identity-title" className="mt-1 text-lg font-extrabold">Who are you on this bill?</h2>
          </div>
          <button aria-label="Close identity picker" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="my-4 grid grid-cols-2 gap-2">
          {participants.map((person) => (
            <div key={person.id} className={`flex items-center justify-between rounded-xl border p-2 ${person.id === activeId ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'}`}>
              <button className="flex-1 truncate p-1 text-left text-sm font-bold" onClick={() => onSelect(person.id)}>{person.name}</button>
              {participants.length > 1 && <button aria-label={`Remove ${person.name}`} className="p-1 text-slate-400 hover:text-rose-600" onClick={() => onRemove(person.id)}><X size={14} /></button>}
            </div>
          ))}
          {participants.length === 0 && <p className="col-span-2 text-sm text-slate-500">Add the first person to this receipt.</p>}
        </div>
        <form className="flex gap-2 border-t border-slate-100 pt-4" onSubmit={submit}>
          <input className="input flex-1" aria-label="Participant name" placeholder="Add your name…" value={name} onChange={(event) => setName(event.target.value)} />
          <button className="button-primary" type="submit">Join</button>
        </form>
      </section>
    </div>
  );
}
