import { useEffect, useState } from 'react';
import { EditReceiptDrawer } from './components/EditReceiptDrawer';
import { Header } from './components/Header';
import { IdentityModal } from './components/IdentityModal';
import { ItemList } from './components/ItemList';
import { ParticipantCards } from './components/ParticipantCards';
import { SeedModal } from './components/SeedModal';
import { UnclaimedBanner } from './components/UnclaimedBanner';
import type { ReceiptSeed } from './types/receipt';
import { computeReceiptMath } from './utils/math';
import { buildExportText } from './utils/exportText';
import {
  createRoomId,
  decodeSeed,
  encodeRoomId,
  encodeSeed,
  hydrateFromSeed,
  parseRoomHash,
} from './store/seedCodec';
import { getRoomProvider, type RoomProvider } from './store/yjsProvider';
import { useReceiptStore } from './store/useReceiptStore';

type ItemFilter = 'all' | 'unclaimed' | 'mine';

function updateHash(roomId: string, seed?: string) {
  const params = new URLSearchParams({ room: encodeRoomId(roomId) });
  if (seed) params.set('seed', seed);
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${params}`);
}

function snapshotToSeed(snapshot: ReturnType<typeof useReceiptStore>): ReceiptSeed {
  return {
    title: snapshot.title,
    cardTipEur: snapshot.cardTipEur,
    cashTipEur: snapshot.cashTipEur,
    bankUsd: snapshot.bankUsd,
    roster: snapshot.participants.map((participant) => participant.name),
    items: snapshot.items.map(({ id, name, en, eur }) => ({ id, name, en, eur })),
  };
}

export default function App() {
  const [room] = useState(() => {
    const parsed = parseRoomHash(window.location.hash);
    return {
      id: parsed.roomId || createRoomId(),
      seed: parsed.seed,
    };
  });
  const [provider, setProvider] = useState<RoomProvider | null>(null);
  const [loadingError, setLoadingError] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState<ItemFilter>('all');
  const [identityOpen, setIdentityOpen] = useState(false);
  const [seedOpen, setSeedOpen] = useState(false);
  const [toast, setToast] = useState('');
  const snapshot = useReceiptStore(provider?.store ?? null);
  const math = computeReceiptMath(snapshot);

  useEffect(() => {
    let active = true;
    getRoomProvider(room.id, decodeSeed(room.seed))
      .then((roomProvider) => {
        if (active) setProvider(roomProvider);
      })
      .catch(() => {
        if (active) setLoadingError('Could not open this receipt room.');
      });
    if (!parseRoomHash(window.location.hash).roomId) updateHash(room.id, room.seed ?? undefined);
    return () => {
      active = false;
    };
  }, [room.id, room.seed]);

  useEffect(() => {
    if (!provider || snapshot.participants.length === 0) return;
    if (!activeId || !snapshot.participants.some((person) => person.id === activeId)) {
      const saved = window.localStorage.getItem(`splitsmart-user-${room.id}`);
      setActiveId(
        snapshot.participants.find((person) => person.id === saved)?.id ??
          snapshot.participants[0].id,
      );
    }
  }, [activeId, provider, room.id, snapshot.participants]);

  useEffect(() => {
    if (!provider) return;
    const identity = snapshot.participants.find((person) => person.id === activeId);
    provider.setIdentity(
      identity
        ? { id: identity.id, name: identity.name, colorIdx: identity.colorIdx }
        : null,
    );
    if (identity) window.localStorage.setItem(`splitsmart-user-${room.id}`, identity.id);
  }, [activeId, provider, room.id, snapshot.participants]);

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
    const seed = encodeSeed(snapshotToSeed(snapshot));
    updateHash(room.id, seed);
    void navigator.clipboard?.writeText(window.location.href).then(() => showToast('Room link copied.'));
  }

  function importSeed(seed: ReceiptSeed, forceReset: boolean) {
    if (!provider) return;
    hydrateFromSeed(provider.doc, seed, { forceReset });
    updateHash(room.id, encodeSeed(seed));
    setSeedOpen(false);
    showToast(`Imported ${seed.items.length} receipt items.`);
  }

  function loadPreset(seed: ReceiptSeed) {
    importSeed(seed, true);
  }

  function newBlankRoom() {
    const blank: ReceiptSeed = {
      title: 'European Receipt',
      cardTipEur: 0,
      cashTipEur: 0,
      bankUsd: 0,
      roster: [],
      items: [],
    };
    const nextRoom = createRoomId();
    updateHash(nextRoom, encodeSeed(blank));
    window.location.reload();
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
        roomId={room.id}
        activeId={activeId}
        peers={snapshot.peers}
        participants={snapshot.participants}
        editing={editing}
        onIdentity={() => setIdentityOpen(true)}
        onEdit={() => setEditing((value) => !value)}
        onShare={shareRoom}
      />
      <UnclaimedBanner
        items={snapshot.items}
        total={math.itemsSubtotalEur}
        filter={filter}
        onFilter={setFilter}
      />
      <main className="mx-auto grid max-w-6xl gap-4 px-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-4">
          {editing && provider && (
            <EditReceiptDrawer
              snapshot={snapshot}
              onMeta={(key, value) => provider.store.setMeta(key, value)}
              onAddItem={(name, en, eur) => provider.store.addItem(name, en, eur)}
            />
          )}
          <ItemList
            items={snapshot.items}
            participants={snapshot.participants}
            activeId={activeId}
            editing={editing}
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
              <div className="flex justify-between"><dt>Items subtotal</dt><dd className="font-mono font-bold">€{math.itemsSubtotalEur.toFixed(2)}</dd></div>
              <div className="flex justify-between"><dt>Card total</dt><dd className="font-mono">€{math.cardTotalEur.toFixed(2)}</dd></div>
              <div className="flex justify-between"><dt>Bank charge</dt><dd className="font-mono">${snapshot.bankUsd.toFixed(2)}</dd></div>
              <div className="flex justify-between border-t border-slate-100 pt-1 font-bold"><dt>Exchange rate</dt><dd className="font-mono">${math.effectiveRate.toFixed(4)} / €</dd></div>
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
