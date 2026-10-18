import { inject, Pipe, PipeTransform } from '@angular/core';

import { LanguageService } from '../services/language.service';
import { toCents } from '../utils/balance';
import { formatMoney } from '../utils/money';

// Un importo come arriva dall'API (`amount`, `share`: stringhe Decimal senza
// zeri finali, "5" invece di "5.00") nel formato della lingua: "5,00 €".
// `{{ expense.amount | amount: expense.currency }}`; con `null` come valuta
// solo la cifra. Per i centesimi gia' calcolati c'e' la pipe `money`.
// Impura perche' segue la lingua scelta nel Profilo.
@Pipe({
  name: 'amount',
  standalone: true,
  pure: false,
})
export class AmountPipe implements PipeTransform {
  private language = inject(LanguageService);

  transform(value: string | number | null | undefined, currency: string | null = 'EUR'): string {
    return formatMoney(toCents(value), this.language.current(), currency);
  }
}
