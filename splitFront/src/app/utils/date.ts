/**
 * Giorno della spesa (`Expense.date`): un giorno di calendario, senza ora ne'
 * fuso. Si manda all'API come 'YYYY-MM-DD' e torna come
 * 'YYYY-MM-DDT00:00:00.000Z' (mezzanotte UTC), quindi va sempre letto come
 * stringa, mai convertito nel fuso del dispositivo: a ovest di Greenwich
 * `new Date(...)` lo farebbe slittare al giorno prima. Nei template si mostra
 * con `date: 'dd/MM/yyyy' : 'UTC'`.
 */

// Oggi nel fuso del dispositivo, come 'YYYY-MM-DD'.
export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// 'YYYY-MM-DD' da un valore dell'API o di ion-datetime ('' se non valido).
export function dayOf(value: string | null | undefined): string {
  const day = (value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : '';
}
