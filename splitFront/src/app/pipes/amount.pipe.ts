import { Pipe, PipeTransform } from '@angular/core';

import { formatCents, toCents } from '../utils/balance';

// Importo sempre con 2 decimali ("5" -> "5.00"): gli amount/share arrivano
// dall'API come stringhe Decimal senza zeri finali, e senza questa pipe le
// liste mostravano "5 EUR" mentre dettaglio e saldi "5.00 EUR".
@Pipe({
  name: 'amount',
  standalone: true,
})
export class AmountPipe implements PipeTransform {
  transform(value: string | number | null | undefined): string {
    return formatCents(toCents(value));
  }
}
