import { Injectable, signal } from '@angular/core';

import { normalizeStartDay } from '../utils/spending';

const STORAGE_KEY = 'split.monthStartDay';

// Giorno in cui inizia il "mese" delle spese (es. il 25, quando arriva lo
// stipendio), letto da "Speso questo mese" e dalla pagina Spese. Salvato solo
// sul dispositivo, come la lingua: su un altro telefono o PC va reimpostato
// (scelta per l'alpha, vedi CLAUDE.md).
@Injectable({
  providedIn: 'root',
})
export class SpendingSettingsService {
  readonly monthStartDay = signal(readStoredDay());

  setMonthStartDay(value: number) {
    const day = normalizeStartDay(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(day));
    } catch {
      // Storage non disponibile (es. navigazione privata): vale per la sessione.
    }
    this.monthStartDay.set(day);
  }
}

function readStoredDay(): number {
  try {
    return normalizeStartDay(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 1;
  }
}
