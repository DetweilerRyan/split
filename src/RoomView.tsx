import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EditReceiptDrawer } from './components/EditReceiptDrawer';
import { Header } from './components/Header';
import { IdentityModal } from './components/IdentityModal';
import { ItemList } from './components/ItemList';
import { ParticipantCards } from './components/ParticipantCards';
import { SeedModal } from './components/SeedModal';
import { UnclaimedBanner } from './components/UnclaimedBanner';
import { useActiveIdentity } from './hooks/useActiveIdentity';
import { useRoomProvider } from './hooks/useRoomProvider';
import type { ReceiptSeed } from './types/receipt';
import { computeReceiptMath } from './utils/math';
import { formatMoney, localeCurrency } from './utils/currency';
import { getExchangeRate } from './utils/exchangeRates';
import { buildExportText } from './utils/exportText';
import {
  createRoomId,
  hydrateFromSeed,
  pendingSeedKey,
  roomPath,
  validateSeed,
} from './store/seedCodec';
import { useReceiptStore } from './store/useReceiptStore';

type ItemFilter = 'all' | 'unclaimed' | 'mine';

function readPendingSeed(roomId: string): ReceiptSeed | null {
  try {
    const raw = window.sessionStorage.getItem(pendingSeedKey(roomId));
    return raw ? validateSeed(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export default function RoomView({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [seed] = useState(() => readPendingSeed(roomId));
  const { provider, error: loadingError } = useRoomProvider(roomId, seed);
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState<ItemFilter>('all');
  const [identityOpen, setIdentityOpen] = useState(false);
  const [seedOpen, setSeedOpen] = useState(false);
  const [toast, setToast] = useState('');
  const snapshot = useReceiptStore(provider?.store ?? null);
  const math = computeReceiptMath(snapshot);
  const [activeId, setActiveId] = useActiveIdentity(provider, roomId, snapshot.participants);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }

  function chooseIdentity(id: string) {
    setActiveId(id);
    setIdentityOpen(false);
  }

  function addParticipant(name: string) {
    const participant = provider?.store.addParticipant(name);
    if (participant) chooseIdentity(participant.id);
    else {
      const id = `p-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
      if (snapshot.participants.some((person) => person.id === id)) chooseIdentity(id);
      else showToast('Enter a participant name.');
    }
  }

  function removeParticipant(id: string) {
    provider?.store.removeParticipant(id);
    if (id === activeId) setActiveId(null);
  }

  function shareRoom() {
    void navigator.clipboard?.writeText(`${window.location.origin}${roomPath(roomId)}`).then(() => showToast('Room link copied.'));
  }

  function importSeed(seed: ReceiptSeed, forceReset: boolean) {
    if (!provider) return;
    hydrateFromSeed(provider.doc, seed, { forceReset });
    setSeedOpen(false);
    showToast(`Imported ${seed.items.length} receipt items.`);
  }

  function loadPreset(seed: ReceiptSeed) {
    importSeed(seed, true);
  }

  function newBlankRoom() {
    const blank: ReceiptSeed = {
      title: 'New Receipt',
      cardTipEur: 0,
      cashTipEur: 0,
      bankUsd: 0,
      currency: localeCurrency(),
      roster: [],
      items: [],
    };
    const nextRoom = createRoomId();
    try {
      window.sessionStorage.setItem(pendingSeedKey(nextRoom), JSON.stringify(blank));
    } catch {}
    router.push(roomPath(nextRoom));
  }

  async function changeDisplayCurrency(code: string, force = false, base = snapshot.currency) {
    if (!provider) return;
    if (!code || code === base) {
      provider.store.setExchangeRate('', 0, '');
      return;
    }
    provider.store.setExchangeRate(code, 0, '');
    const result = await getExchangeRate(base, code, { force });
    if (result) provider.store.setExchangeRate(code, result.rate, result.date);
    else showToast('Exchange rate unavailable offline; showing receipt currency only.');
  }

  function copySummary() {
    void navigator.clipboard?.writeText(buildExportText(snapshot)).then(() => showToast('Summary copied.'));
  }

  if (loadingError) {
    return <main className="mx-auto max-w-xl p-8 text-center text-rose-700">{loadingError}</main>;
  }

  const totals = math.perPerson;

  return (
    <div className="min-h-screen pb-12">
      <Header
        roomId={roomId}
        activeId={activeId}
        connection={snapshot.connection}
        peers={snapshot.peers}
        participants={snapshot.participants}
        editing={editing}
        onIdentity={() => setIdentityOpen(true)}
        onEdit={() => setEditing((value) => !value)}
        onShare={shareRoom}
      />
      <UnclaimedBanner
        items={snapshot.items}
        total={math.itemsSubtotal}
        currency={math.currency}
        filter={filter}
        onFilter={setFilter}
      />
      <main className="mx-auto grid max-w-6xl gap-4 px-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-4">
          {editing && provider && (
            <EditReceiptDrawer
              snapshot={snapshot}
              onMeta={(key, value) => provider.store.setMeta(key, value)}
              onCurrency={(code) => {
                provider.store.setMeta('currency', code);
                if (snapshot.displayCurrency) void changeDisplayCurrency(snapshot.displayCurrency, false, code);
              }}
              onDisplayCurrency={changeDisplayCurrency}
              onRate={(rate) => provider.store.setExchangeRate(snapshot.displayCurrency, rate, new Date().toISOString().slice(0, 10))}
              onAddItem={(name, en, eur) => provider.store.addItem(name, en, eur)}
            />
          )}
          <ItemList
            items={snapshot.items}
            participants={snapshot.participants}
            activeId={activeId}
            editing={editing}
            currency={math.currency}
            filter={filter}
            onClaim={(itemId, participantId) => provider?.store.toggleClaim(itemId, participantId)}
            onClaimAll={(itemId, participants, claimed) =>
              provider?.store.setClaims(itemId, participants.map((person) => person.id), claimed)
            }
            onUpdate={(itemId, field, value) => provider?.store.updateItem(itemId, field, value)}
            onDelete={(itemId) => provider?.store.deleteItem(itemId)}
          />
        </div>
        <aside className="space-y-4">
          <section className="card space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-slate-900">{snapshot.title}</h2>
                <p className="text-xs text-slate-500">Live receipt split</p>
              </div>
              <button className="button-secondary" onClick={copySummary}>Copy summary</button>
            </div>
            <dl className="space-y-1 border-t border-slate-100 pt-3 text-sm">
              <div className="flex justify-between"><dt>Currency</dt><dd className="font-mono">{math.currency}</dd></div>
              <div className="flex justify-between"><dt>Items subtotal</dt><dd className="font-mono font-bold">{formatMoney(math.itemsSubtotal, math.currency)}</dd></div>
              <div className="flex justify-between"><dt>Card total</dt><dd className="font-mono">{formatMoney(math.cardTotal, math.currency)}</dd></div>
              {math.displayCurrency && math.effectiveRate !== null && (
                <>
                  {snapshot.bankUsd > 0 && <div className="flex justify-between"><dt>Bank charge</dt><dd className="font-mono">{formatMoney(snapshot.bankUsd, math.displayCurrency)}</dd></div>}
                  <div className="flex justify-between border-t border-slate-100 pt-1 font-bold"><dt>Exchange rate{math.isEstimatedRate && snapshot.rateDate ? ` (${snapshot.rateDate})` : ''}</dt><dd className="font-mono">{math.effectiveRate.toFixed(4)} {math.displayCurrency} / {math.currency}</dd></div>
                </>
              )}
            </dl>
          </section>
          <ParticipantCards snapshot={snapshot} />
          <section className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold">Receipt seed</h2>
              <button className="button-secondary" onClick={() => setSeedOpen(true)}>Seed / presets</button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Data persists on this device and syncs with room peers.</p>
            <p className="mt-2 text-xs text-slate-500">{snapshot.participants.length} people · {snapshot.items.length} items</p>
          </section>
        </aside>
      </main>
      <IdentityModal
        open={identityOpen}
        participants={snapshot.participants}
        activeId={activeId}
        onClose={() => setIdentityOpen(false)}
        onSelect={chooseIdentity}
        onAdd={addParticipant}
        onRemove={removeParticipant}
      />
      <SeedModal
        open={seedOpen}
        onClose={() => setSeedOpen(false)}
        onImport={importSeed}
        onPreset={loadPreset}
        onBlankRoom={newBlankRoom}
      />
      {toast && <div role="status" className="fixed bottom-4 right-4 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-lg">{toast}</div>}
      {!provider && <div className="fixed bottom-4 left-4 text-xs text-slate-500">Restoring this room…</div>}
      {Object.keys(totals).length === 0 && provider && <div className="sr-only">No participants yet.</div>}
    </div>
  );
}
