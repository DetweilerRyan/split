import { useMemo } from 'react';
import { Copy, X } from 'lucide-react';
import { ModalDialog } from './ModalDialog';
import { qrSvgPath } from '@/utils/qr';

interface ShareModalProps {
  readonly open: boolean;
  readonly url: string;
  readonly onClose: () => void;
  readonly onCopy: () => void;
}

export function ShareModal({ open, url, onClose, onCopy }: ShareModalProps) {
  const qr = useMemo(() => (open ? qrSvgPath(url) : null), [open, url]);
  if (!open || !qr) return null;

  return (
    <ModalDialog labelledBy="share-title" onClose={onClose}>
      <div className="flex items-start justify-between">
        <div>
          <h2 id="share-title" className="text-lg font-extrabold">
            Share this room
          </h2>
          <p className="text-xs text-slate-500">Scan the code or copy the link to join.</p>
        </div>
        <button
          aria-label="Close share dialog"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <svg
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- The QR code is drawn as an SVG path; role="img" names it as one image.
        role="img"
        aria-label="QR code for the room link"
        viewBox={`0 0 ${qr.size} ${qr.size}`}
        shapeRendering="crispEdges"
        className="mx-auto my-4 block w-[min(80vw,18rem)] rounded-xl border border-slate-200 bg-white"
      >
        <rect width={qr.size} height={qr.size} fill="#fff" />
        <path d={qr.path} fill="#0f172a" />
      </svg>
      <input
        className="input font-mono text-xs"
        readOnly
        value={url}
        aria-label="Room link"
        onFocus={(event) => event.currentTarget.select()}
      />
      <button className="button-primary mt-3 w-full justify-center" onClick={onCopy}>
        <Copy size={14} /> Copy link
      </button>
    </ModalDialog>
  );
}
