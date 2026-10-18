import { RouterLink } from '@angular/router';
import { Component, inject, ViewChild } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { addIcons } from 'ionicons';
import { add, chevronForward, searchOutline } from 'ionicons/icons';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ExpenseListItem, ExpenseService } from '../../services/expense.service';
import { SettlementService } from '../../services/settlement.service';
import { isSmartSplit } from '../../models/category.model';
import { BalanceSummary, computeBalances } from '../../utils/balance';
import { MoneyPipe } from '../../pipes/money.pipe';
import { ExpenseFormModal } from '../expense-form/expense-form.modal';
import { MonthlySpendingComponent } from '../../components/monthly-spending/monthly-spending.component';
import { ExpenseListComponent } from '../../components/expense-list/expense-list.component';
import { LoadingSkeletonComponent } from '../../components/loading-skeleton/loading-skeleton.component';
import { ProfileButtonComponent } from '../../components/profile-button/profile-button.component';

// Tab Attivita': i due lavori dell'app alla pari, in due riquadri gemelli
// (speso del mese -> pagina Spese, saldo netto -> tab Saldi), poi le spese con
// in grande la mia quota. Gruppi e saldi per persona hanno ciascuno la propria
// tab, quindi qui non si ripetono.
@Component({
  selector: 'app-activity',
  templateUrl: './activity.page.html',
  standalone: true,
  imports: [
    ExpenseListComponent,
    LoadingSkeletonComponent,
    ProfileButtonComponent,
    IonButton,
    IonButtons,
    IonCard,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonText,
    IonTitle,
    IonToolbar,
    MonthlySpendingComponent,
    MoneyPipe,
    RouterLink,
    TranslatePipe,
  ],
})
export class ActivityPage {
  private authService = inject(AuthService);
  private expenseService = inject(ExpenseService);
  private settlementService = inject(SettlementService);
  private modalCtrl = inject(ModalController);
  private translate = inject(TranslateService);

  expenses: ExpenseListItem[] = [];
  // Le spese mostrate: tutte, o quelle che corrispondono alla ricerca.
  filteredExpenses: ExpenseListItem[] = [];
  searchOpen = false;
  query = '';

  @ViewChild(IonSearchbar) private searchbar?: IonSearchbar;
  summary: BalanceSummary = computeBalances([], null);
  loaded = false;
  loadError = false;

  constructor() {
    addIcons({ add, 'chevron-forward': chevronForward, 'search-outline': searchOutline });
  }

  // Non ngOnInit: la pagina resta montata nella tab, e una spesa creata da
  // un gruppo deve comparire anche qui.
  ionViewWillEnter() {
    this.loadExpenses();
  }

  // I rimborsi servono solo al saldo netto (la lista mostra le spese): senza,
  // la card direbbe una cifra diversa dalla tab Saldi.
  loadExpenses(onDone?: () => void) {
    this.loadError = false;
    forkJoin({
      expenses: this.expenseService.list(),
      settlements: this.settlementService.list(),
    }).subscribe({
      next: ({ expenses, settlements }) => {
        this.expenses = expenses;
        this.applyFilter();
        this.summary = computeBalances(
          expenses,
          this.authService.currentUser()?.publicId,
          settlements,
        );
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
    this.loadExpenses(() => (event.target as HTMLIonRefresherElement).complete());
  }

  toggleSearch() {
    this.searchOpen = !this.searchOpen;
    if (this.searchOpen) {
      // La searchbar esiste solo dopo il render: focus al ciclo successivo.
      setTimeout(() => this.searchbar?.setFocus());
    } else {
      this.query = '';
      this.applyFilter();
    }
  }

  onSearch(event: Event) {
    this.query = (event as CustomEvent<{ value?: string | null }>).detail.value ?? '';
    this.applyFilter();
  }

  // Ricerca locale sulle spese gia' caricate (nessuna chiamata HTTP): per
  // descrizione, chi ha pagato, gruppo e categoria. Ignora maiuscole e accenti,
  // cosi' "attivita" trova anche "Attività".
  // Le spese della divisione intelligente non si elencano: spostano debiti, non
  // sono spese fatte (restano visibili nella lista del loro gruppo). Restano
  // invece in `expenses`, che alimenta la card del saldo: cambiano a chi devi.
  private applyFilter() {
    const listed = this.expenses.filter((expense) => !isSmartSplit(expense));
    const q = normalize(this.query);
    if (!q) {
      this.filteredExpenses = listed;
      return;
    }
    this.filteredExpenses = listed.filter((expense) =>
      [
        expense.description,
        expense.paidBy.nickName,
        expense.group?.name,
        expense.category?.name ??
          (expense.category?.slug
            ? this.translate.instant('categories.' + expense.category.slug)
            : ''),
      ].some((field) => normalize(field).includes(q)),
    );
  }

  // Nuova spesa senza contesto: nessun gruppo precompilato.
  async openExpenseForm() {
    const modal = await this.modalCtrl.create({ component: ExpenseFormModal });
    await modal.present();

    const { role } = await modal.onWillDismiss();
    if (role === 'created') {
      this.loadExpenses();
    }
  }
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
