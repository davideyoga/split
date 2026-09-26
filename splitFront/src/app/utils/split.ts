/**
 * Divisione di un importo fra i contributori di una spesa, in centesimi interi.
 * Funzioni pure come quelle di `balance.ts`.
 */

// Divisione equa al centesimo, identica a quella del backend
// (`ExpenseService.equalContributions`): i centesimi di resto vanno uno a
// testa ai primi, cosi' la somma fa sempre esattamente `totalCents`.
export function splitEqually(totalCents: number, count: number): number[] {
  if (count <= 0) {
    return [];
  }
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

// Quote "eque" se differiscono al massimo di un centesimo (il resto della
// divisione). Cosi' in modifica una spesa divisa in parti uguali non viene
// scambiata per una divisione personalizzata.
export function isEqualSplit(cents: readonly number[]): boolean {
  return cents.length === 0 || Math.max(...cents) - Math.min(...cents) <= 1;
}
