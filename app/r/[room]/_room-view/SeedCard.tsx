import type { RoomSnapshot } from '@/domain/receipt/roomSnapshot';
import { mergeClasses } from '@/utils/mergeClasses';

type SeedCardProps = {
  /** The receipt whose people and items it counts. */
  readonly snapshot: Pick<RoomSnapshot, 'participants' | 'items'>;
  /** Opens the seed dialog. */
  readonly onOpen: () => void;
  /** Where the caller places it; merged with its own classes. */
  readonly className?: string | undefined;
};

/** The card that opens the seed dialog, and counts the receipt's people and items. */
export function SeedCard({ snapshot, onOpen, className }: SeedCardProps) {
  return (
    <section className={mergeClasses('card p-4', className)}>
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
