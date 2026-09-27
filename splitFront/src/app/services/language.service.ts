import { inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type AppLang = 'it' | 'en';

const STORAGE_KEY = 'split.lang';
const SUPPORTED: readonly AppLang[] = ['it', 'en'];

// Lingua iniziale: quella scelta dall'utente (localStorage) se c'e', altrimenti
// quella del dispositivo (it se navigator.language inizia per "it", altrimenti
// en). Funzione pura, senza DI: main.ts la passa a provideTranslateService come
// `lang`, cosi' la lingua giusta e' attiva fin dal primo render.
export function detectInitialLang(): AppLang {
  return readStoredLang() ?? (navigator.language?.toLowerCase().startsWith('it') ? 'it' : 'en');
}

function readStoredLang(): AppLang | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED.includes(stored as AppLang) ? (stored as AppLang) : null;
  } catch {
    return null;
  }
}

// Lingua dell'app (vedi detectInitialLang per quella di avvio). Si salva solo
// una scelta esplicita dal Profilo, cosi' chi non ha mai scelto continua a
// seguire la lingua del dispositivo.
@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private translate = inject(TranslateService);

  readonly supported = SUPPORTED;
  readonly current = signal<AppLang>('en');

  // La lingua e' gia' stata impostata da provideTranslateService: qui si
  // allinea solo lo stato locale.
  init() {
    this.translate.addLangs([...SUPPORTED]);
    const lang = (this.translate.getCurrentLang() as AppLang | null) ?? detectInitialLang();
    this.current.set(lang);
    document.documentElement.lang = lang;
  }

  set(lang: AppLang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Storage non disponibile (es. navigazione privata): vale per la sessione.
    }
    this.apply(lang);
  }

  private apply(lang: AppLang) {
    this.current.set(lang);
    this.translate.use(lang);
    document.documentElement.lang = lang;
  }
}
