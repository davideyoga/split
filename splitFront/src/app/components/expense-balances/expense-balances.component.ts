import { Component, computed, inject, input, output } from '@angular/core';
import {
  IonButton,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../services/auth.service';
import {
  Balance,
  BalanceExpenseInput,
  BalanceSettlementInput,
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
  imports: [TranslatePipe, IonButton, IonItem, IonLabel, IonList, IonListHeader, IonNote],
})
export class ExpenseBalancesComponent {
  // Le spese su cui calcolare i saldi: qualunque lista con `paidBy` e
  // `expenseContributions` (es. il risultato di `ExpenseService.list()` o di
  // `listByGroup()`). I saldi si ricalcolano da soli quando l'input cambia.
  readonly expenses = input.required<readonly BalanceExpenseInput[]>();

  // Rimborsi da scalare dai saldi (es. `SettlementService.list()`). Vuoti di
  // default: il segmento Saldi del gruppo non li passa, perche' un rimborso
  // non appartiene a nessun gruppo.
  readonly settlements = input<readonly BalanceSettlementInput[]>([]);

  // Punto di vista del calcolo. Di norma l'utente loggato; sovrascrivibile per
  // riusare il componente dal punto di vista di qualcun altro.
  readonly userPublicId = input('');

  // Chiave i18n del titolo, cosi' ogni pagina puo' dargli il proprio. Vuota =
  // nessuna intestazione (es. la tab Saldi, che ha gia' "Saldi" come titolo).
  readonly titleKey = input('balances.title');

  // Valuta mostrata accanto agli importi: per ora sempre EUR (vedi V2.0).
  readonly currency = input('EUR');

  readonly showTotals = input(true);

  // Bottone "Salda" per riga: emette `settle` con il saldo della controparte.
  // Spento di default (lo accende la tab Saldi).
  readonly showSettleAction = input(false);
  readonly settle = output<Balance>();

  // Se valorizzata, l'empty state mostra un bottone con questa label che
  // emette `emptyAction` (es. "Aggiungi una spesa").
  readonly emptyCtaKey = input('');
  readonly emptyAction = output<void>();

  private authService = inject(AuthService);

  private readonly mePublicId = computed(
    () => this.userPublicId() || this.authService.currentUser()?.publicId || '',
  );

  readonly summary = computed(() =>
    computeBalances(this.expenses(), this.mePublicId(), this.settlements()),
  );

  format = formatCents;
  formatSigned = formatSignedCents;
}
