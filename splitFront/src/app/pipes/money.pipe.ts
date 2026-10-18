import { inject, Pipe, PipeTransform } from '@angular/core';

import { LanguageService } from '../services/language.service';
import { formatMoney } from '../utils/money';

// Centesimi interi (saldi, totali, quote calcolate nell'app) nel formato della
// lingua: `{{ cents | money }}` -> "84,50 €"; `{{ cents | money: null }}` ->
// "84,50"; `{{ cents | money: 'EUR' : true }}` -> "+84,50 €" (vedi
// formatMoney). Impura perche' segue la lingua scelta nel Profilo.
@Pipe({
  name: 'money',
  standalone: true,
  pure: false,
})
export class MoneyPipe implements PipeTransform {
  private language = inject(LanguageService);

  transform(
    cents: number | null | undefined,
    currency: string | null = 'EUR',
    signed = false,
  ): string {
    return formatMoney(cents ?? 0, this.language.current(), currency, signed);
  }
}
