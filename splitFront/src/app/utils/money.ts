/**
 * Importi da mostrare, nel formato della lingua dell'app: "84,50 €" in
 * italiano, "€84.50" in inglese. Solo per leggere: i campi da modificare
 * (importo della spesa, quote, rimborso) restano numeri semplici "84.50",
 * scritti con `formatCents` di utils/balance.ts.
 */

const formatters = new Map<string, Intl.NumberFormat>();

/**
 * `cents` in centesimi interi. Senza `currency` (null) solo la cifra, per le
 * righe secondarie dove la valuta e' gia' chiara ("hai prestato 56,33").
 * Senza `signed` si mostra il valore assoluto (il segno lo dice il testo
 * accanto: "devi", "ti deve"); con `signed` "+20,57 €" / "-43,67 €" (0 senza
 * segno).
 */
export function formatMoney(
  cents: number,
  lang: string,
  currency: string | null = 'EUR',
  signed = false,
): string {
  const key = `${lang}|${currency ?? ''}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(lang, {
      ...(currency ? { style: 'currency', currency } : {}),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatters.set(key, formatter);
  }
  // Il segno a mano, davanti a tutto: "+20,57 €", "-€43.67".
  const sign = signed && cents > 0 ? '+' : signed && cents < 0 ? '-' : '';
  return sign + formatter.format(Math.abs(cents) / 100);
}

// Il simbolo della valuta ("€"), da mettere accanto a un campo importo.
export function currencySymbol(currency = 'EUR', lang = 'it'): string {
  return (
    new Intl.NumberFormat(lang, { style: 'currency', currency })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency
  );
}
