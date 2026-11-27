type SeedCardProps = {
  /** How many people and items the receipt has. */
  readonly participantCount: number;
  readonly itemCount: number;
  /** Opens the seed dialog. */
  readonly onOpen: () => void;
};

/** The card that opens the seed dialog, and counts the receipt's people and items. */
export function SeedCard({ participantCount, itemCount, onOpen }: SeedCardProps) {
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
        {participantCount} people · {itemCount} items
      </p>
    </section>
  );
}
