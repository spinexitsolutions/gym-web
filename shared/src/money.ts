/** All money is stored in minor units (paise for INR). */
export function formatMoney(minor: number, currency = 'INR', locale = 'en-IN'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);
}
export const toMinor = (major: number) => Math.round(major * 100);
