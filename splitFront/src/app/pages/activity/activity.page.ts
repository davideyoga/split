import { RouterLink } from '@angular/router';
import { Component, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonChip,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
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
import { add, searchOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { ExpenseListItem, ExpenseService } from '../../services/expense.service';
import { CATEGORY_ICONS } from '../../models/category.model';
import {
  BalanceSummary,
  computeBalances,
  formatCents,
  formatSignedCents,
} from '../../utils/balance';
import { AmountPipe } from '../../pipes/amount.pipe';
import { ExpenseFormModal } from '../expense-form/expense-form.modal';

// Tab Attivita': card saldo netto (-> tab Saldi) + spese recenti. Gruppi e
// saldi per persona hanno ciascuno la propria tab, quindi qui non si ripetono.
@Component({
  selector: 'app-activity',
  templateUrl: './activity.page.html',
  styleUrls: ['./activity.page.scss'],
  standalone: true,
  imports: [
    AmountPipe,
    CommonModule,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonChip,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonText,
    IonTitle,
    IonToolbar,
    RouterLink,
    TranslatePipe,
  ],
})
export class ActivityPage {
  private authService = inject(AuthService);
  private expenseService = inject(ExpenseService);
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

  format = formatCents;
  formatSigned = formatSignedCents;

  constructor() {
    // Le icone delle categorie arrivano dal DB: vanno registrate tutte.
    addIcons({ add, 'search-outline': searchOutline, ...CATEGORY_ICONS });
  }

  // Non ngOnInit: la pagina resta montata nella tab, e una spesa creata da
  // un gruppo deve comparire anche qui.
  ionViewWillEnter() {
    this.loadExpenses();
  }

  loadExpenses(onDone?: () => void) {
    this.loadError = false;
    this.expenseService.list().subscribe({
      next: (expenses) => {
        this.expenses = expenses;
        this.applyFilter();
        this.summary = computeBalances(expenses, this.authService.currentUser()?.publicId);
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
  private applyFilter() {
    const q = normalize(this.query);
    if (!q) {
      this.filteredExpenses = this.expenses;
      return;
    }
    this.filteredExpenses = this.expenses.filter((expense) =>
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
