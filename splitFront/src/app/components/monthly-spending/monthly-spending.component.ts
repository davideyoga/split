import { Component, computed, inject, input } from '@angular/core';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../services/auth.service';
import { formatCents } from '../../utils/balance';
import { computeMonthlySpending, SpendingExpenseInput } from '../../utils/spending';

// "Speso questo mese": la somma delle quote dell'utente loggato sulle spese del
// mese corrente, piu' quanto ha pagato di tasca propria. Presentazionale come
// `app-expense-balances`: riceve le spese gia' caricate, nessuna chiamata HTTP.
@Component({
  selector: 'app-monthly-spending',
  templateUrl: './monthly-spending.component.html',
  standalone: true,
  imports: [TranslatePipe, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle],
})
export class MonthlySpendingComponent {
  readonly expenses = input.required<readonly SpendingExpenseInput[]>();

  // Valuta mostrata accanto agli importi: per ora sempre EUR (vedi V2.0).
  readonly currency = input('EUR');

  private authService = inject(AuthService);

  readonly spending = computed(() =>
    computeMonthlySpending(this.expenses(), this.authService.currentUser()?.publicId),
  );

  format = formatCents;
}
