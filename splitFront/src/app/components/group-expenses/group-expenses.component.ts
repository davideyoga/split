import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { ExpenseListItem, ExpenseService } from '../../services/expense.service';
import { ExpenseListComponent } from '../expense-list/expense-list.component';
import { LoadingSkeletonComponent } from '../loading-skeleton/loading-skeleton.component';

// Lista delle spese di un gruppo, usata dentro la pagina di dettaglio gruppo.
@Component({
  selector: 'app-group-expenses',
  templateUrl: './group-expenses.component.html',
  standalone: true,
  imports: [ExpenseListComponent, LoadingSkeletonComponent, TranslatePipe, IonButton],
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
  // Lo scheletro si mostra solo al primo caricamento: ai successivi resta la
  // lista vecchia finche' non arriva la nuova.
  loaded = false;
  loadError = false;

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
    this.loadError = false;
    this.expenseService.listByGroup(this.groupPublicId).subscribe({
      next: (expenses) => {
        this.expenses = expenses;
        this.loaded = true;
        this.expensesLoaded.emit(expenses);
        onDone?.();
      },
      error: () => {
        this.loadError = true;
        this.expensesLoaded.emit([]);
        onDone?.();
      },
    });
  }
}
