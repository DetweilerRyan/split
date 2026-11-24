import { CalendarDays, Globe, MapPin, Phone, Utensils, X } from 'lucide-react';
import { ModalDialog } from './ModalDialog';
import type { RoomSnapshot } from '../domain/receipt/roomSnapshot';
import { formatPurchaseTime, parsePurchasedAt } from '../domain/receipt/mealInfo';
import { mapsLink, parseWebsiteLink, phoneLink } from '../domain/receipt/restaurantLinks';
import type { RoomId } from '../domain/room/roomId';

interface RestaurantModalProps {
  readonly open: boolean;
  readonly snapshot: RoomSnapshot;
  readonly roomId: RoomId;
  readonly onClose: () => void;
}

interface DetailRow {
  readonly icon: typeof MapPin;
  readonly label: string;
  readonly value: string;
  readonly link?: URL | null;
}

/** The restaurant details the receipt has, in the order the dialog lists them. */
function detailRows(snapshot: RoomSnapshot) {
  const rows: DetailRow[] = [];
  const purchase = parsePurchasedAt(snapshot.purchasedAt);
  if (purchase) {
    const { day, time } = formatPurchaseTime(purchase);
    rows.push({ icon: CalendarDays, label: 'When', value: time ? `${day} · ${time}` : day });
  }
  if (snapshot.mealType) rows.push({ icon: Utensils, label: 'Meal', value: snapshot.mealType });
  if (snapshot.address) {
    const link = mapsLink(snapshot.title, snapshot.address);
    rows.push({ icon: MapPin, label: 'Address', value: snapshot.address, link });
  }
  if (snapshot.phone) {
    rows.push({
      icon: Phone,
      label: 'Phone',
      value: snapshot.phone,
      link: phoneLink(snapshot.phone),
    });
  }
  const website = snapshot.website.trim();
  if (website)
    rows.push({ icon: Globe, label: 'Website', value: website, link: parseWebsiteLink(website) });
  return rows;
}

export function RestaurantModal({ open, snapshot, roomId, onClose }: RestaurantModalProps) {
  if (!open) return null;
  const rows = detailRows(snapshot);

  return (
    <ModalDialog labelledBy="restaurant-title" onClose={onClose}>
      <div className="flex items-start justify-between gap-2">
        <h2 id="restaurant-title" className="text-lg font-extrabold">
          {snapshot.title}
        </h2>
        <button
          aria-label="Close restaurant details"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      {rows.length ? (
        <dl className="mt-3 space-y-3">
          {rows.map(({ icon: Icon, label, value, link }) => (
            <div key={label} className="flex items-start gap-3">
              <Icon size={16} className="mt-0.5 shrink-0 text-indigo-600" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {label}
                </dt>
                <dd className="break-words text-sm text-slate-900">
                  {link ? (
                    <a
                      className="text-indigo-600 underline"
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {value}
                    </a>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          No restaurant details were found on this receipt.
        </p>
      )}
      <p className="mt-4 truncate font-mono text-xs text-slate-400">room: {roomId}</p>
    </ModalDialog>
  );
}
