import { User } from '../models/user.model';

/**
 * Calcolo dei saldi fra l'utente corrente e le sue controparti, a partire da una
 * lista di spese gia' caricata.
 *
 * Funzioni pure, senza dipendenze da Angular ne' da HTTP: il componente
 * `app-expense-balances` le usa per la UI, ma restano riutilizzabili altrove
 * (altri componenti, test, eventualmente il backend).
 */

// Forma minima richiesta a una spesa: chi ha pagato e le quote dei partecipanti.
// `ExpenseListItem` (services/expense.service.ts) la soddisfa gia', ma qualunque
// oggetto con questa forma va bene: il calcolo non dipende dal resto della spesa.
export interface BalanceContributionInput {
  share: string | number;
  user: User;
}

export interface BalanceExpenseInput {
  paidBy: User;
  expenseContributions: BalanceContributionInput[];
}

export interface Balance {
  // La controparte, cioe' l'altra persona coinvolta nel saldo.
  user: User;
  // Importo in centesimi: > 0 = la controparte deve a me, < 0 = io devo a lei.
  cents: number;
}

export interface BalanceSummary {
  // Solo le controparti con un saldo diverso da zero, dal credito piu' alto al
  // debito piu' alto.
  balances: Balance[];
  owedToMeCents: number;
  iOweCents: number;
  netCents: number;
}

// `share` e `amount` arrivano dall'API come stringhe (i Decimal di Prisma
// vengono serializzati cosi'). Tutti i conti si fanno in centesimi interi per
// non accumulare errori di virgola mobile sommando molte spese.
export function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function computeBalances(
  expenses: readonly BalanceExpenseInput[] | null | undefined,
  mePublicId: string | null | undefined,
): BalanceSummary {
  const byCounterpart = new Map<string, Balance>();

  if (mePublicId) {
    for (const expense of expenses ?? []) {
      const payer = expense?.paidBy;
      if (!payer?.publicId) {
        continue;
      }

      for (const contribution of expense.expenseContributions ?? []) {
        const debtor = contribution?.user;
        // La quota di chi ha pagato non genera un debito verso se stesso.
        if (!debtor?.publicId || debtor.publicId === payer.publicId) {
          continue;
        }

        // Il credito di chi ha pagato si costruisce sommando le quote altrui, e
        // mai come `amount - quota propria`: le share sono arrotondate a 2
        // decimali una per una, quindi solo la somma delle share chiude a zero.
        const share = toCents(contribution.share);
        if (share === 0) {
          continue;
        }

        if (payer.publicId === mePublicId) {
          accumulate(byCounterpart, debtor, share);
        } else if (debtor.publicId === mePublicId) {
          accumulate(byCounterpart, payer, -share);
        }
        // Spese fra terzi: non toccano il mio saldo, si ignorano.
      }
    }
  }

  const balances: Balance[] = [];
  let owedToMeCents = 0;
  let iOweCents = 0;

  for (const balance of byCounterpart.values()) {
    // Saldo in pari: la controparte non va mostrata.
    if (balance.cents === 0) {
      continue;
    }
    balances.push(balance);
    if (balance.cents > 0) {
      owedToMeCents += balance.cents;
    } else {
      iOweCents -= balance.cents;
    }
  }

  // Prima chi mi deve di piu', in fondo quelli a cui devo di piu'.
  balances.sort((a, b) => b.cents - a.cents);

  return {
    balances,
    owedToMeCents,
    iOweCents,
    netCents: owedToMeCents - iOweCents,
  };
}

// Valore assoluto formattato: il segno lo comunica la UI (colore + etichetta).
export function formatCents(cents: number): string {
  return (Math.abs(cents) / 100).toFixed(2);
}

export function formatSignedCents(cents: number): string {
  if (cents > 0) {
    return `+${formatCents(cents)}`;
  }
  if (cents < 0) {
    return `-${formatCents(cents)}`;
  }
  return formatCents(cents);
}

function accumulate(
  byCounterpart: Map<string, Balance>,
  user: User,
  cents: number,
): void {
  const existing = byCounterpart.get(user.publicId);
  if (existing) {
    existing.cents += cents;
  } else {
    byCounterpart.set(user.publicId, { user, cents });
  }
}
