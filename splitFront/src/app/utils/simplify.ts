import { User } from '../models/user.model';
import { BalanceExpenseInput, toCents } from './balance';

/**
 * Divisione intelligente delle spese di un gruppo: dai debiti a coppie di tutto
 * il gruppo al minimo di pagamenti che lascia a ognuno lo stesso netto, e le
 * spese di compensazione che portano dai primi ai secondi.
 *
 * Funzioni pure come quelle di `balance.ts`: la modale `SmartSplitModal` le usa
 * per l'anteprima, il backend si limita a creare le spese calcolate qui.
 */

// `from` deve `cents` (> 0) a `to`.
export interface Debt {
  from: User;
  to: User;
  cents: number;
}

export interface RebalanceShare {
  user: User;
  cents: number;
}

// Spesa di compensazione: pagata da `payer` (con quota 0) per le persone in
// `shares`. Il suo importo e' `totalCents`, la somma delle quote.
export interface RebalanceExpense {
  payer: User;
  shares: RebalanceShare[];
  totalCents: number;
}

export interface RebalancePlan {
  // Debiti a coppie di oggi.
  current: Debt[];
  // Pagamenti che bastano a chiudere tutto, con lo stesso netto per ognuno.
  simplified: Debt[];
  // Spese da creare per passare da `current` a `simplified`. Vuota se non c'e'
  // niente da semplificare.
  expenses: RebalanceExpense[];
}

// Debiti a coppie di tutto il gruppo (non dal punto di vista di un utente):
// per ogni spesa, ogni contributore diverso dal pagatore deve la sua quota al
// pagatore. Per ogni coppia resta un solo debito, al netto delle due direzioni.
export function computeGroupDebts(
  expenses: readonly BalanceExpenseInput[] | null | undefined,
): Debt[] {
  const users = new Map<string, User>();
  const pairs = new Map<string, number>();

  for (const expense of expenses ?? []) {
    const payer = expense?.paidBy;
    if (!payer?.publicId) {
      continue;
    }
    users.set(payer.publicId, payer);

    for (const contribution of expense.expenseContributions ?? []) {
      const debtor = contribution?.user;
      if (!debtor?.publicId || debtor.publicId === payer.publicId) {
        continue;
      }
      users.set(debtor.publicId, debtor);
      addToPair(pairs, debtor.publicId, payer.publicId, toCents(contribution.share));
    }
  }

  return pairsToDebts(pairs, users);
}

// Il minimo di pagamenti (al piu' n-1) che lascia a ognuno il netto che ha
// con `debts`. Prima si abbinano debitori e creditori con importi identici (un
// pagamento chiude due persone), poi il debitore piu' grande paga il creditore
// piu' grande. Deterministico, a parita' di importo decide il publicId: ogni
// membro del gruppo deve vedere lo stesso risultato.
export function simplifyDebts(debts: readonly Debt[]): Debt[] {
  const nets = new Map<string, { user: User; cents: number }>();
  const addNet = (user: User, cents: number) => {
    const existing = nets.get(user.publicId);
    if (existing) {
      existing.cents += cents;
    } else {
      nets.set(user.publicId, { user, cents });
    }
  };
  for (const debt of debts) {
    addNet(debt.from, -debt.cents);
    addNet(debt.to, debt.cents);
  }

  // Quanto deve dare (debitori) o ricevere (creditori) ciascuno, sempre > 0.
  const debtors = [...nets.values()]
    .filter((n) => n.cents < 0)
    .map((n) => ({ user: n.user, cents: -n.cents }));
  const creditors = [...nets.values()]
    .filter((n) => n.cents > 0)
    .map((n) => ({ user: n.user, cents: n.cents }));
  const byAmount = (a: { user: User; cents: number }, b: { user: User; cents: number }) =>
    b.cents - a.cents || compareIds(a.user.publicId, b.user.publicId);

  const result: Debt[] = [];

  debtors.sort(byAmount);
  creditors.sort(byAmount);
  for (const debtor of debtors) {
    const match = creditors.find((c) => c.cents > 0 && c.cents === debtor.cents);
    if (match) {
      result.push({ from: debtor.user, to: match.user, cents: debtor.cents });
      match.cents = 0;
      debtor.cents = 0;
    }
  }

  for (;;) {
    const debtor = debtors.filter((d) => d.cents > 0).sort(byAmount)[0];
    const creditor = creditors.filter((c) => c.cents > 0).sort(byAmount)[0];
    if (!debtor || !creditor) {
      break;
    }
    const cents = Math.min(debtor.cents, creditor.cents);
    result.push({ from: debtor.user, to: creditor.user, cents });
    debtor.cents -= cents;
    creditor.cents -= cents;
  }

  return result.sort(compareDebts);
}

// Anteprima completa: debiti di oggi, pagamenti semplificati e spese di
// compensazione. Per ogni coppia il delta fra obiettivo e situazione attuale
// diventa una quota in una spesa pagata da chi deve ricevere di piu', una sola
// spesa per pagatore. Prese tutte insieme le spese lasciano invariato il netto
// di ognuno; una sola, invece, no (per questo si creano in un'unica
// transazione, POST /api/expense/batch).
export function planRebalance(
  expenses: readonly BalanceExpenseInput[] | null | undefined,
): RebalancePlan {
  const current = computeGroupDebts(expenses);
  const simplified = simplifyDebts(current);
  if (simplified.length >= current.length) {
    return { current, simplified, expenses: [] };
  }

  const users = new Map<string, User>();
  const delta = new Map<string, number>();
  for (const debt of simplified) {
    users.set(debt.from.publicId, debt.from);
    users.set(debt.to.publicId, debt.to);
    addToPair(delta, debt.from.publicId, debt.to.publicId, debt.cents);
  }
  for (const debt of current) {
    users.set(debt.from.publicId, debt.from);
    users.set(debt.to.publicId, debt.to);
    addToPair(delta, debt.from.publicId, debt.to.publicId, -debt.cents);
  }

  // Ogni delta e' un debito da aggiungere: chi lo riceve paga la spesa, chi lo
  // deve ci ha la quota.
  const byPayer = new Map<string, RebalanceExpense>();
  for (const debt of pairsToDebts(delta, users)) {
    let expense = byPayer.get(debt.to.publicId);
    if (!expense) {
      expense = { payer: debt.to, shares: [], totalCents: 0 };
      byPayer.set(debt.to.publicId, expense);
    }
    expense.shares.push({ user: debt.from, cents: debt.cents });
    expense.totalCents += debt.cents;
  }

  const rebalance = [...byPayer.values()];
  for (const expense of rebalance) {
    expense.shares.sort((a, b) => compareIds(a.user.publicId, b.user.publicId));
  }
  rebalance.sort((a, b) => compareIds(a.payer.publicId, b.payer.publicId));

  return { current, simplified, expenses: rebalance };
}

// Le coppie sono indicizzate con i due publicId in ordine, e il valore ha
// segno: > 0 = il primo deve al secondo, < 0 = il contrario.
function addToPair(
  pairs: Map<string, number>,
  debtorId: string,
  creditorId: string,
  cents: number,
): void {
  if (cents === 0) {
    return;
  }
  const [first, second] =
    compareIds(debtorId, creditorId) < 0 ? [debtorId, creditorId] : [creditorId, debtorId];
  const key = `${first}|${second}`;
  const signed = first === debtorId ? cents : -cents;
  pairs.set(key, (pairs.get(key) ?? 0) + signed);
}

function pairsToDebts(pairs: Map<string, number>, users: Map<string, User>): Debt[] {
  const debts: Debt[] = [];
  for (const [key, cents] of pairs) {
    if (cents === 0) {
      continue;
    }
    const [first, second] = key.split('|');
    const firstUser = users.get(first);
    const secondUser = users.get(second);
    if (!firstUser || !secondUser) {
      continue;
    }
    debts.push(
      cents > 0
        ? { from: firstUser, to: secondUser, cents }
        : { from: secondUser, to: firstUser, cents: -cents },
    );
  }
  return debts.sort(compareDebts);
}

// Dal debito piu' grande; a parita', ordine fisso sui publicId.
function compareDebts(a: Debt, b: Debt): number {
  return (
    b.cents - a.cents ||
    compareIds(a.from.publicId, b.from.publicId) ||
    compareIds(a.to.publicId, b.to.publicId)
  );
}

// Confronto sui codici dei caratteri, non `localeCompare`: il risultato non
// deve dipendere dalla lingua del dispositivo.
function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
