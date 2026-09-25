import { Component, inject } from '@angular/core';
import {
  AlertController,
  IonContent,
  IonHeader,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ExpenseBalancesComponent } from '../../components/expense-balances/expense-balances.component';
import { ExpenseListItem, ExpenseService } from '../../services/expense.service';
import { Balance } from '../../utils/balance';
import { ExpenseFormModal } from '../expense-form/expense-form.modal';

// Tab Saldi: `app-expense-balances` a piena pagina sulle spese dell'utente, con
// il bottone "Salda" per riga. Ricarica a ogni ingresso nella tab
// (ionViewWillEnter, non ngOnInit): le pagine di una shell a tab restano
// montate, quindi senza questo una spesa creata da un'altra tab non
// comparirebbe nei saldi.
@Component({
  selector: 'app-balances',
  templateUrl: './balances.page.html',
  standalone: true,
  imports: [
    ExpenseBalancesComponent,
    IonContent,
    IonHeader,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar,
    TranslatePipe,
  ],
})
export class BalancesPage {
  private expenseService = inject(ExpenseService);
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);
  private translate = inject(TranslateService);

  expenses: ExpenseListItem[] = [];

  ionViewWillEnter() {
    this.loadExpenses();
  }

  loadExpenses(onDone?: () => void) {
    this.expenseService.list().subscribe({
      next: (expenses) => {
        this.expenses = expenses;
        onDone?.();
      },
      error: () => {
        this.expenses = [];
        onDone?.();
      },
    });
  }

  refresh(event: Event) {
    this.loadExpenses(() => (event.target as HTMLIonRefresherElement).complete());
  }

  // Scorciatoia per l'alpha: non esiste ancora un modello `Settlement` lato
  // backend (TODO.md, "Saldare i debiti"), quindi "Salda" spiega che la
  // funzione e' in arrivo invece di sparire dal design.
  async settle(balance: Balance) {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('balances.settle-title', {
        name: balance.user.nickName,
      }),
      message: this.translate.instant('balances.settle-coming-soon'),
      buttons: [this.translate.instant('balances.ok')],
    });
    await alert.present();
  }

  async openExpenseForm() {
    const modal = await this.modalCtrl.create({ component: ExpenseFormModal });
    await modal.present();

    const { role } = await modal.onWillDismiss();
    if (role === 'created') {
      this.loadExpenses();
    }
  }
}
