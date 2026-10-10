import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonIcon,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { chevronForward } from 'ionicons/icons';

import { AuthService } from '../../services/auth.service';
import { SpendingSettingsService } from '../../services/spending-settings.service';
import { formatCents } from '../../utils/balance';
import { formatDay } from '../../utils/date';
import {
  computeMonthlySpending,
  SpendingExpenseInput,
  spendingPeriod,
} from '../../utils/spending';

// "Speso questo mese": la somma delle quote dell'utente loggato sulle spese del
// periodo in corso, piu' quanto ha pagato di tasca propria. Il periodo parte dal
// giorno scelto nella pagina Spese (default il 1°). Presentazionale come
// `app-expense-balances`: riceve le spese gia' caricate, nessuna chiamata HTTP.
// Toccandola si apre la pagina Spese (dettaglio per categoria).
@Component({
  selector: 'app-monthly-spending',
  templateUrl: './monthly-spending.component.html',
  styleUrls: ['./monthly-spending.component.scss'],
  standalone: true,
  imports: [
    RouterLink,
    TranslatePipe,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonIcon,
  ],
})
export class MonthlySpendingComponent {
  readonly expenses = input.required<readonly SpendingExpenseInput[]>();

  // Valuta mostrata accanto agli importi: per ora sempre EUR (vedi V2.0).
  readonly currency = input('EUR');

  private authService = inject(AuthService);
  private settings = inject(SpendingSettingsService);

  readonly startDay = this.settings.monthStartDay;

  // Il periodo si calcola insieme alle spese, che arrivano a ogni ingresso in
  // Attivita': cosi' "oggi" si aggiorna anche se l'app resta aperta a cavallo
  // di due periodi.
  readonly view = computed(() => {
    const period = spendingPeriod(this.settings.monthStartDay());
    return {
      spending: computeMonthlySpending(
        this.expenses(),
        this.authService.currentUser()?.publicId,
        period,
      ),
      since: formatDay(period.start, false),
    };
  });

  format = formatCents;

  constructor() {
    addIcons({ 'chevron-forward': chevronForward });
  }
}
