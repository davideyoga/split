import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { ExpenseBalancesComponent } from '../../components/expense-balances/expense-balances.component';
import { ExpenseListItem, ExpenseService } from '../../services/expense.service';

// Tab Saldi. Per ora e' `app-expense-balances` a piena pagina sulle spese
// dell'utente. L'azione "Salda" per riga arriva nella fase 5 (dipende dal
// modello `Settlement` lato backend, gia' tracciato in TODO.md).
@Component({
  selector: 'app-balances',
  templateUrl: './balances.page.html',
  standalone: true,
  imports: [
    CommonModule,
    ExpenseBalancesComponent,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    TranslatePipe,
  ],
})
export class BalancesPage implements OnInit {
  private expenseService = inject(ExpenseService);

  expenses: ExpenseListItem[] = [];

  ngOnInit() {
    this.expenseService.list().subscribe({
      next: (expenses) => (this.expenses = expenses),
      error: () => (this.expenses = []),
    });
  }
}
