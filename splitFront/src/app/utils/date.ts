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

// Il giorno `delta` giorni dopo (o prima, se negativo) di un 'YYYY-MM-DD'.
// Calcolo di calendario in UTC, quindi senza salti per l'ora legale.
export function addDays(day: string, delta: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + delta)).toISOString().slice(0, 10);
}

// Nome del mese di un 'YYYY-MM-DD' nella lingua data ("ottobre", "October").
export function monthName(day: string, lang: string): string {
  return formatUtcDay(day, lang, { month: 'long' });
}

// Giorno per esteso nella lingua data, con l'iniziale maiuscola ("Venerdì 16
// ottobre", "Friday, October 16"), con l'anno se richiesto.
export function longDay(day: string, lang: string, withYear: boolean): string {
  const text = formatUtcDay(day, lang, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
  });
  return text.charAt(0).toLocaleUpperCase(lang) + text.slice(1);
}

// Il giorno diventa la mezzanotte UTC e si formatta in UTC: resta lo stesso
// giorno in qualsiasi fuso del dispositivo.
function formatUtcDay(day: string, lang: string, options: Intl.DateTimeFormatOptions): string {
  const [year, month, date] = dayOf(day).split('-').map(Number);
  if (!year) {
    return '';
  }
  return new Intl.DateTimeFormat(lang, { ...options, timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, date)),
  );
}

// 'dd/MM/yyyy' (o 'dd/MM' senza anno) da un giorno 'YYYY-MM-DD...', letto come
// stringa. Per i giorni calcolati nell'app, che non hanno la 'T00:00:00.000Z'
// dei valori dell'API: il DatePipe li leggerebbe come mezzanotte locale, e con
// il fuso 'UTC' in Italia mostrerebbe il giorno prima.
export function formatDay(value: string | null | undefined, withYear = true): string {
  const day = dayOf(value);
  if (!day) {
    return '';
  }
  const short = `${day.slice(8, 10)}/${day.slice(5, 7)}`;
  return withYear ? `${short}/${day.slice(0, 4)}` : short;
}
