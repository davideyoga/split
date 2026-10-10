import { isSmartSplit } from '../models/category.model';
import { BalanceExpenseInput, toCents } from './balance';
import { dayOf, todayIso } from './date';

/**
 * Quanto ha speso l'utente corrente in un periodo, a partire da una lista di
 * spese gia' caricata, totale e per categoria. Funzioni pure come quelle di
 * `balance.ts`.
 *
 * Il periodo e' un "mese" che inizia nel giorno scelto dall'utente (es. il 25,
 * quando arriva lo stipendio: dal 25 di un mese al 24 del successivo). I giorni
 * sono stringhe 'YYYY-MM-DD' e non diventano mai una `Date` locale (vedi
 * utils/date.ts): si confrontano come stringhe, che in quel formato hanno lo
 * stesso ordine delle date.
 */

// Categoria come arriva dentro una spesa (ExpenseCategory la soddisfa).
export interface SpendingCategory {
  publicId: string;
  slug: string | null;
  name: string | null;
  icon: string;
}

export interface SpendingExpenseInput extends BalanceExpenseInput {
  // Giorno della spesa scelto dall'utente ('YYYY-MM-DD...', vedi utils/date.ts).
  date: string;
  category?: SpendingCategory | null;
}

// Estremi inclusi, 'YYYY-MM-DD'.
export interface SpendingPeriod {
  start: string;
  end: string;
}

export interface CategorySpending {
  // publicId della categoria, '' per le spese senza categoria.
  key: string;
  category: SpendingCategory | null;
  shareCents: number;
  // Percentuale intera del totale; le righe sommano sempre a 100.
  percent: number;
}

export interface MonthlySpending {
  // Somma delle mie quote: il costo che resta a mio carico, chiunque abbia pagato.
  shareCents: number;
  // Somma degli importi che ho pagato io (anche per gli altri).
  paidCents: number;
  // Spese del periodo in cui ho una quota o che ho pagato.
  count: number;
  // Le mie quote per categoria, dalla piu' alta; senza le categorie a quota 0.
  byCategory: CategorySpending[];
}

// Giorno d'inizio valido (1-31); qualsiasi altro valore torna al default, 1.
export function normalizeStartDay(value: unknown): number {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : 1;
}

// Periodo che contiene `ref` (oggi, nel fuso del dispositivo, se omesso). Un
// giorno d'inizio che il mese non ha (29-31) diventa l'ultimo giorno di quel
// mese: con il 31, a febbraio il periodo parte il 28 (o il 29).
export function spendingPeriod(startDay: number, ref: string = todayIso()): SpendingPeriod {
  const day = normalizeStartDay(startDay);
  let { year, month } = parseMonth(ref);
  let start = startOf(year, month, day);
  if (ref < start) {
    ({ year, month } = addMonths(year, month, -1));
    start = startOf(year, month, day);
  }
  const next = addMonths(year, month, 1);
  return { start, end: previousDay(startOf(next.year, next.month, day)) };
}

// Il periodo `delta` mesi prima (negativo) o dopo (positivo) di `period`.
export function shiftPeriod(
  period: SpendingPeriod,
  delta: number,
  startDay: number,
): SpendingPeriod {
  const day = normalizeStartDay(startDay);
  const { year, month } = parseMonth(period.start);
  const target = addMonths(year, month, delta);
  return spendingPeriod(day, startOf(target.year, target.month, day));
}

export function computeMonthlySpending(
  expenses: readonly SpendingExpenseInput[] | null | undefined,
  mePublicId: string | null | undefined,
  period: SpendingPeriod,
): MonthlySpending {
  const result: MonthlySpending = { shareCents: 0, paidCents: 0, count: 0, byCategory: [] };
  if (!mePublicId) {
    return result;
  }

  const categories = new Map<string, CategorySpending>();

  for (const expense of expenses ?? []) {
    if (!countsIn(expense, period)) {
      continue;
    }

    const myContribution = myContributionTo(expense, mePublicId);
    const iPaid = expense.paidBy?.publicId === mePublicId;
    if (!myContribution && !iPaid) {
      continue;
    }

    const shareCents = toCents(myContribution?.share);
    result.count++;
    result.shareCents += shareCents;
    if (iPaid) {
      // L'importo pagato e' la somma di tutte le quote, non `amount`: sulle
      // spese salvate prima del 2026-09-26 le due cifre possono differire di
      // un centesimo, e cosi' resta coerente con i saldi.
      result.paidCents += (expense.expenseContributions ?? []).reduce(
        (sum, contribution) => sum + toCents(contribution?.share),
        0,
      );
    }

    // Una quota 0 (ho pagato per gli altri) non e' spesa mia: niente riga.
    if (shareCents > 0) {
      const key = expense.category?.publicId ?? '';
      const row = categories.get(key) ?? {
        key,
        category: expense.category ?? null,
        shareCents: 0,
        percent: 0,
      };
      row.shareCents += shareCents;
      categories.set(key, row);
    }
  }

  result.byCategory = withPercents(
    [...categories.values()].sort(
      (a, b) => b.shareCents - a.shareCents || compareCodePoints(a.key, b.key),
    ),
    result.shareCents,
  );
  return result;
}

// Le spese della riga `categoryKey` di computeMonthlySpending ('' = senza
// categoria), con gli stessi filtri: la somma delle mie quote e' l'importo
// della riga. Nell'ordine in cui arrivano (l'API le manda dalla piu' recente).
export function expensesInCategory<T extends SpendingExpenseInput>(
  expenses: readonly T[] | null | undefined,
  mePublicId: string | null | undefined,
  period: SpendingPeriod,
  categoryKey: string,
): T[] {
  if (!mePublicId) {
    return [];
  }
  return (expenses ?? []).filter(
    (expense) =>
      countsIn(expense, period) &&
      (expense.category?.publicId ?? '') === categoryKey &&
      toCents(myContributionTo(expense, mePublicId)?.share) > 0,
  );
}

// Spesa del periodo. Le spese della divisione intelligente spostano debiti,
// non sono spesa.
function countsIn(expense: SpendingExpenseInput, period: SpendingPeriod): boolean {
  if (isSmartSplit(expense)) {
    return false;
  }
  const day = dayOf(expense?.date);
  return !!day && day >= period.start && day <= period.end;
}

function myContributionTo(expense: SpendingExpenseInput, mePublicId: string) {
  return expense.expenseContributions?.find(
    (contribution) => contribution?.user?.publicId === mePublicId,
  );
}

// Percentuali intere con il metodo dei resti maggiori: arrotondando ogni riga
// per conto suo, tre categorie da un terzo farebbero 99%.
function withPercents(rows: CategorySpending[], totalCents: number): CategorySpending[] {
  if (totalCents <= 0) {
    return rows;
  }
  const exact = rows.map((row) => (row.shareCents * 100) / totalCents);
  rows.forEach((row, i) => (row.percent = Math.floor(exact[i])));
  let left = 100 - rows.reduce((sum, row) => sum + row.percent, 0);
  const byRemainder = rows
    .map((_, i) => i)
    .sort((a, b) => exact[b] - Math.floor(exact[b]) - (exact[a] - Math.floor(exact[a])) || a - b);
  for (const i of byRemainder) {
    if (left <= 0) {
      break;
    }
    rows[i].percent++;
    left--;
  }
  return rows;
}

// Ordine stabile e uguale su ogni dispositivo (localeCompare dipende dalla lingua).
function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function parseMonth(iso: string): { year: number; month: number } {
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) };
}

// month 1-12, delta qualsiasi.
function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function daysInMonth(year: number, month: number): number {
  // Giorno 0 del mese dopo = ultimo giorno di questo. In UTC: e' solo un
  // calcolo di calendario, il fuso del dispositivo non deve entrarci.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function startOf(year: number, month: number, startDay: number): string {
  return isoDay(year, month, Math.min(startDay, daysInMonth(year, month)));
}

function previousDay(iso: string): string {
  const { year, month } = parseMonth(iso);
  const day = Number(iso.slice(8, 10));
  if (day > 1) {
    return isoDay(year, month, day - 1);
  }
  const before = addMonths(year, month, -1);
  return isoDay(before.year, before.month, daysInMonth(before.year, before.month));
}

function isoDay(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
