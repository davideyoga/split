import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  IonButton,
  IonChip,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
} from '@ionic/angular/standalone';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import { CATEGORY_ICONS } from '../../models/category.model';
import { AmountPipe } from '../../pipes/amount.pipe';
import { ExpenseListItem, ExpenseService } from '../../services/expense.service';

// Lista delle spese di un gruppo, usata dentro la pagina di dettaglio gruppo.
@Component({
  selector: 'app-group-expenses',
  templateUrl: './group-expenses.component.html',
  styleUrls: ['./group-expenses.component.scss'],
  standalone: true,
  imports: [
    AmountPipe,
    CommonModule,
    RouterLink,
    TranslatePipe,
    IonButton,
    IonChip,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonNote,
  ],
})
export class GroupExpensesComponent implements OnChanges {
  @Input({ required: true }) groupPublicId = '';

  // Le spese caricate qui servono anche alla pagina che ci contiene (per i
  // saldi), che altrimenti dovrebbe rifare la stessa chiamata.
  @Output() expensesLoaded = new EventEmitter<ExpenseListItem[]>();

  // Il bottone dell'empty state: la pagina che ci contiene apre la modale
  // nuova spesa con il gruppo precompilato.
  @Output() addExpense = new EventEmitter<void>();

  private expenseService = inject(ExpenseService);

  expenses: ExpenseListItem[] = [];
  loading = false;
  loadError = false;

  constructor() {
    // Le icone delle categorie arrivano dal DB: vanno registrate tutte.
    addIcons({ ...CATEGORY_ICONS });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['groupPublicId']) {
      this.loadExpenses();
    }
  }

  // `onDone` serve al pull-to-refresh della pagina per chiudere lo spinner.
  loadExpenses(onDone?: () => void) {
    if (!this.groupPublicId) {
      onDone?.();
      return;
    }
    this.loading = true;
    this.loadError = false;
    this.expenseService.listByGroup(this.groupPublicId).subscribe({
      next: (expenses) => {
        this.expenses = expenses;
        this.loading = false;
        this.expensesLoaded.emit(expenses);
        onDone?.();
      },
      error: () => {
        this.loadError = true;
        this.loading = false;
        this.expensesLoaded.emit([]);
        onDone?.();
      },
    });
  }
}
