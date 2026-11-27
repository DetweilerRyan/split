import type { RoomSnapshot } from '@/domain/receipt/roomSnapshot';

type SeedCardProps = {
  /** The receipt whose people and items it counts. */
  readonly snapshot: Pick<RoomSnapshot, 'participants' | 'items'>;
  /** Opens the seed dialog. */
  readonly onOpen: () => void;
};

/** The card that opens the seed dialog, and counts the receipt's people and items. */
export function SeedCard({ snapshot, onOpen }: SeedCardProps) {
  return (
    <section className="card p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-extrabold">Receipt seed</h2>
        <button className="button-secondary" onClick={onOpen}>
          Seed / presets
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Data persists on this device and syncs with room peers.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        {snapshot.participants.length} people · {snapshot.items.length} items
      </p>
    </section>
  );
}
