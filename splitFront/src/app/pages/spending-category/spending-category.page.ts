import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { ExpenseListComponent } from '../../components/expense-list/expense-list.component';
import { AuthService } from '../../services/auth.service';
import { ExpenseListItem, ExpenseService } from '../../services/expense.service';
import { SpendingSettingsService } from '../../services/spending-settings.service';
import { toCents } from '../../utils/balance';
import { MoneyPipe } from '../../pipes/money.pipe';
import { dayOf, formatDay } from '../../utils/date';
import { expensesInCategory, SpendingPeriod, spendingPeriod } from '../../utils/spending';

// Le spese di una categoria in un periodo, aperta toccando una riga della
// pagina Spese. Categoria e periodo arrivano nei query param (`category` =
// publicId, assente per "Senza categoria"; `from`/`to` = 'YYYY-MM-DD'), cosi'
// la pagina si ricarica da sola e regge un refresh. Ogni riga mostra la mia
// quota, che e' quello che somma la riga della pagina Spese.
@Component({
  selector: 'app-spending-category',
  templateUrl: './spending-category.page.html',
  styleUrls: ['./spending-category.page.scss'],
  standalone: true,
  imports: [
    MoneyPipe,
    ExpenseListComponent,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar,
    TranslatePipe,
  ],
})
export class SpendingCategoryPage {
  private authService = inject(AuthService);
  private expenseService = inject(ExpenseService);
  private settings = inject(SpendingSettingsService);
  private route = inject(ActivatedRoute);

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly allExpenses = signal<ExpenseListItem[]>([]);
  loaded = false;
  loadError = false;

  readonly me = computed(() => this.authService.currentUser()?.publicId);
  readonly categoryKey = computed(() => this.params().get('category') ?? '');

  // Senza un periodo valido nell'URL (link scritto a mano) vale quello in corso.
  readonly period = computed<SpendingPeriod>(() => {
    const start = dayOf(this.params().get('from'));
    const end = dayOf(this.params().get('to'));
    return start && end && start <= end
      ? { start, end }
      : spendingPeriod(this.settings.monthStartDay());
  });

  readonly periodLabel = computed(
    () => `${formatDay(this.period().start)} – ${formatDay(this.period().end)}`,
  );

  readonly expenses = computed(() =>
    expensesInCategory(this.allExpenses(), this.me(), this.period(), this.categoryKey()),
  );

  // Dalle spese stesse: una categoria personalizzata di un altro utente o
  // archiviata non c'e' fra quelle che GET /api/category mi restituisce.
  readonly category = computed(() => this.expenses()[0]?.category ?? null);

  readonly totalCents = computed(() => {
    const me = this.me();
    return this.expenses().reduce(
      (sum, expense) =>
        sum + toCents(expense.expenseContributions.find((c) => c.user.publicId === me)?.share),
      0,
    );
  });


  ionViewWillEnter() {
    this.load();
  }

  load(onDone?: () => void) {
    this.loadError = false;
    this.expenseService.list().subscribe({
      next: (expenses) => {
        this.allExpenses.set(expenses);
        this.loaded = true;
        onDone?.();
      },
      error: () => {
        this.loadError = true;
        onDone?.();
      },
    });
  }

  refresh(event: Event) {
    this.load(() => (event.target as HTMLIonRefresherElement).complete());
  }
}
