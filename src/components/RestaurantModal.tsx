import { CalendarDays, Globe, MapPin, Phone, Utensils, X } from 'lucide-react';
import type { RoomSnapshot } from '../types/receipt';
import { formatPurchaseTime, guessMeal, parsePurchasedAt } from '../utils/mealInfo';

interface RestaurantModalProps {
  open: boolean;
  snapshot: RoomSnapshot;
  roomId: string;
  onClose: () => void;
}

export function RestaurantModal({ open, snapshot, roomId, onClose }: RestaurantModalProps) {
  if (!open) return null;
  const purchase = parsePurchasedAt(snapshot.purchasedAt);
  const when = purchase ? formatPurchaseTime(purchase) : null;
  const meal = guessMeal(purchase, snapshot.items.length);
  const website = snapshot.website.trim();
  const websiteHref = /^https?:\/\//i.test(website) ? website : /^[^\s@]+\.[^\s@]+$/.test(website) && !website.includes('@') ? `https://${website}` : null;
  const mapsHref = snapshot.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${snapshot.title} ${snapshot.address}`)}`
    : null;

  const rows = [
    when && { icon: CalendarDays, label: 'When', value: `${when.day}${when.time ? ` · ${when.time}` : ''}` },
    meal && { icon: Utensils, label: 'Looks like', value: meal },
    snapshot.address && { icon: MapPin, label: 'Address', value: snapshot.address, href: mapsHref },
    snapshot.phone && { icon: Phone, label: 'Phone', value: snapshot.phone, href: `tel:${snapshot.phone.replace(/[^\d+]/g, '')}` },
    website && { icon: Globe, label: 'Website', value: website, href: websiteHref },
  ].filter(Boolean) as { icon: typeof MapPin; label: string; value: string; href?: string | null }[];

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="restaurant-title" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <h2 id="restaurant-title" className="text-lg font-extrabold">{snapshot.title}</h2>
          <button aria-label="Close restaurant details" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose}><X size={18} /></button>
        </div>
        {rows.length ? (
          <dl className="mt-3 space-y-3">
            {rows.map(({ icon: Icon, label, value, href }) => (
              <div key={label} className="flex items-start gap-3">
                <Icon size={16} className="mt-0.5 shrink-0 text-indigo-600" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="break-words text-sm text-slate-900">
                    {href ? <a className="text-indigo-600 underline" href={href} target="_blank" rel="noopener noreferrer">{value}</a> : value}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No restaurant details were found on this receipt.</p>
        )}
        <p className="mt-4 truncate font-mono text-xs text-slate-400">room: {roomId}</p>
      </section>
    </div>
  );
}
