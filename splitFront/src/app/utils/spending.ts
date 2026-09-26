import { BalanceExpenseInput, toCents } from './balance';

/**
 * Quanto ha speso l'utente corrente in un mese, a partire da una lista di spese
 * gia' caricata. Funzione pura come quelle di `balance.ts`.
 */

export interface SpendingExpenseInput extends BalanceExpenseInput {
  // Data ISO della spesa: l'unica data che una spesa ha (vedi `Expense.createdDate`).
  createdDate: string;
}

export interface MonthlySpending {
  // Somma delle mie quote: il costo che resta a mio carico, chiunque abbia pagato.
  shareCents: number;
  // Somma degli importi che ho pagato io (anche per gli altri).
  paidCents: number;
  // Spese del mese in cui ho una quota o che ho pagato.
  count: number;
}

// Il mese e' quello di calendario di `now`, nel fuso orario del dispositivo.
export function computeMonthlySpending(
  expenses: readonly SpendingExpenseInput[] | null | undefined,
  mePublicId: string | null | undefined,
  now: Date = new Date(),
): MonthlySpending {
  const result: MonthlySpending = { shareCents: 0, paidCents: 0, count: 0 };
  if (!mePublicId) {
    return result;
  }

  const year = now.getFullYear();
  const month = now.getMonth();

  for (const expense of expenses ?? []) {
    const date = new Date(expense?.createdDate);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month) {
      continue;
    }

    const myContribution = expense.expenseContributions?.find(
      (contribution) => contribution?.user?.publicId === mePublicId,
    );
    const iPaid = expense.paidBy?.publicId === mePublicId;
    if (!myContribution && !iPaid) {
      continue;
    }

    result.count++;
    result.shareCents += toCents(myContribution?.share);
    if (iPaid) {
      // L'importo pagato e' la somma di tutte le quote, non `amount`: sulle
      // spese salvate prima del 2026-09-26 le due cifre possono differire di
      // un centesimo, e cosi' resta coerente con i saldi.
      result.paidCents += (expense.expenseContributions ?? []).reduce(
        (sum, contribution) => sum + toCents(contribution?.share),
        0,
      );
    }
  }

  return result;
}
