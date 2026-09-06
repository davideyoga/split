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
  IonChip,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import { CATEGORY_ICONS } from '../../models/category.model';
import { ExpenseListItem, ExpenseService } from '../../services/expense.service';

// Lista delle spese di un gruppo, usata dentro la pagina di dettaglio gruppo.
@Component({
  selector: 'app-group-expenses',
  templateUrl: './group-expenses.component.html',
  styleUrls: ['./group-expenses.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
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

  loadExpenses() {
    if (!this.groupPublicId) {
      return;
    }
    this.loading = true;
    this.loadError = false;
    this.expenseService.listByGroup(this.groupPublicId).subscribe({
      next: (expenses) => {
        this.expenses = expenses;
        this.loading = false;
        this.expensesLoaded.emit(expenses);
      },
      error: () => {
        this.loadError = true;
        this.loading = false;
        this.expensesLoaded.emit([]);
      },
    });
  }
}
