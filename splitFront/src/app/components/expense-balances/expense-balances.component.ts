import { Component, computed, inject, input } from '@angular/core';
import {
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../services/auth.service';
import {
  BalanceExpenseInput,
  computeBalances,
  formatCents,
  formatSignedCents,
} from '../../utils/balance';

// Saldi ("chi mi deve quanto" / "a chi devo quanto") calcolati sulla lista di
// spese ricevuta in input. Componente puramente presentazionale: non fa nessuna
// chiamata HTTP, cosi' puo' essere inserito in qualunque pagina che abbia gia'
// delle spese in mano (home, dettaglio gruppo, ...) senza duplicare fetch.
@Component({
  selector: 'app-expense-balances',
  templateUrl: './expense-balances.component.html',
  styleUrls: ['./expense-balances.component.scss'],
  standalone: true,
  imports: [TranslatePipe, IonItem, IonLabel, IonList, IonListHeader, IonNote],
})
export class ExpenseBalancesComponent {
  // Le spese su cui calcolare i saldi: qualunque lista con `paidBy` e
  // `expenseContributions` (es. il risultato di `ExpenseService.list()` o di
  // `listByGroup()`). I saldi si ricalcolano da soli quando l'input cambia.
  readonly expenses = input.required<readonly BalanceExpenseInput[]>();

  // Punto di vista del calcolo. Di norma l'utente loggato; sovrascrivibile per
  // riusare il componente dal punto di vista di qualcun altro.
  readonly userPublicId = input('');

  // Chiave i18n del titolo, cosi' ogni pagina puo' dargli il proprio.
  readonly titleKey = input('balances.title');

  // Valuta mostrata accanto agli importi: per ora sempre EUR (vedi V2.0).
  readonly currency = input('EUR');

  readonly showTotals = input(true);

  private authService = inject(AuthService);

  private readonly mePublicId = computed(
    () => this.userPublicId() || this.authService.currentUser()?.publicId || '',
  );

  readonly summary = computed(() =>
    computeBalances(this.expenses(), this.mePublicId()),
  );

  format = formatCents;
  formatSigned = formatSignedCents;
}
