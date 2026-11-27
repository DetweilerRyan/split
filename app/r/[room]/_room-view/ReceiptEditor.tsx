import { EditReceiptDrawer } from './EditReceiptDrawer';
import { type FetchRate, useExchangeRate } from './useExchangeRate';
import { type ReceiptStore, useReceiptStore } from '@/sync/useReceiptStore';

type ReceiptEditorProps = {
  /** The room's receipt, which it shows and changes. Pass the same one on every render. */
  readonly store: Pick<
    ReceiptStore,
    'subscribe' | 'getSnapshot' | 'setMeta' | 'setExchangeRate' | 'addItem'
  >;
  /** Gets the rate to the currency the receipt is shown in. */
  readonly fetchRate: FetchRate;
  /** Tells the person something, such as that a rate is unavailable offline. */
  readonly notify: (message: string) => void;
};

/** Editing the receipt: its details, currencies, exchange rate and new items. */
export function ReceiptEditor({ store, fetchRate, notify }: ReceiptEditorProps) {
  const snapshot = useReceiptStore(store);
  const rates = useExchangeRate(store, snapshot, fetchRate, notify);
  return (
    <EditReceiptDrawer
      snapshot={snapshot}
      onMeta={(key, value) => store.setMeta(key, value)}
      onCurrency={rates.changeCurrency}
      onDisplayCurrency={(code, force) => void rates.changeDisplayCurrency(code, force)}
      onRate={rates.setRate}
      onAddItem={(name, en, eur) => store.addItem(name, en, eur)}
    />
  );
}
