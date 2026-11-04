export const DEFAULT_CURRENCY = 'USD';

const COMMON_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'CNY', 'HKD', 'SGD', 'KRW', 'INR',
  'MXN', 'BRL', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY', 'ZAR', 'AED', 'ILS',
  'THB', 'IDR', 'MYR', 'PHP', 'KWD', 'BHD', 'JOD', 'OMR', 'TND',
];

const REGION_CURRENCIES: Record<string, string> = {
  US: 'USD', GB: 'GBP', JP: 'JPY', CH: 'CHF', CA: 'CAD', AU: 'AUD', NZ: 'NZD', CN: 'CNY',
  HK: 'HKD', SG: 'SGD', KR: 'KRW', IN: 'INR', MX: 'MXN', BR: 'BRL', SE: 'SEK', NO: 'NOK',
  DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', TR: 'TRY', ZA: 'ZAR', AE: 'AED',
  IL: 'ILS', TH: 'THB', ID: 'IDR', MY: 'MYR', PH: 'PHP', KW: 'KWD', BH: 'BHD', JO: 'JOD',
  OM: 'OMR', TN: 'TND',
  AT: 'EUR', BE: 'EUR', CY: 'EUR', DE: 'EUR', EE: 'EUR', ES: 'EUR', FI: 'EUR', FR: 'EUR',
  GR: 'EUR', HR: 'EUR', IE: 'EUR', IT: 'EUR', LT: 'EUR', LU: 'EUR', LV: 'EUR', MT: 'EUR',
  NL: 'EUR', PT: 'EUR', SI: 'EUR', SK: 'EUR',
};

export function isValidCurrency(code: unknown): code is string {
  if (typeof code !== 'string' || !/^[A-Za-z]{3}$/.test(code)) return false;
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: code });
    return true;
  } catch {
    return false;
  }
}

/** Returns an upper-case ISO 4217 code, falling back to USD for missing/invalid values. */
export function normalizeCurrency(code: unknown): string {
  return isValidCurrency(code) ? code.toUpperCase() : DEFAULT_CURRENCY;
}

/** Number of minor-unit decimals for a currency (JPY 0, USD 2, KWD 3). */
export function currencyExponent(code: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency: normalizeCurrency(code) })
    .resolvedOptions().maximumFractionDigits ?? 2;
}

export function toMinor(amount: number, code: string): number {
  return Math.round(amount * 10 ** currencyExponent(code));
}

export function fromMinor(minor: number, code: string): number {
  return minor / 10 ** currencyExponent(code);
}

export function formatMoney(amount: number, code: string, locale?: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: normalizeCurrency(code) }).format(amount);
}

export function localeCurrency(language?: string): string {
  try {
    const tag = language ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
    const region = new Intl.Locale(tag).maximize().region;
    return (region && REGION_CURRENCIES[region]) || DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

export function listCurrencies(): string[] {
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
      .supportedValuesOf?.('currency');
    if (supported?.length) return supported;
  } catch {}
  return COMMON_CURRENCIES;
}

export function currencyLabel(code: string): string {
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'currency' }).of(code);
    return name && name !== code ? `${code} — ${name}` : code;
  } catch {
    return code;
  }
}
