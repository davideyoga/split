import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  AlertController,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { cashOutline, trashOutline } from 'ionicons/icons';
import { forkJoin } from 'rxjs';

import { ExpenseBalancesComponent } from '../../components/expense-balances/expense-balances.component';
import { SettleUpModal } from '../../components/settle-up/settle-up.modal';
import { Settlement } from '../../models/settlement.model';
import { AmountPipe } from '../../pipes/amount.pipe';
import { AuthService } from '../../services/auth.service';
import { ExpenseListItem, ExpenseService } from '../../services/expense.service';
import { SettlementService } from '../../services/settlement.service';
import { Balance } from '../../utils/balance';
import { ExpenseFormModal } from '../expense-form/expense-form.modal';

// Tab Saldi: `app-expense-balances` a piena pagina sulle spese e sui rimborsi
// dell'utente, con il bottone "Salda" per riga, e sotto lo storico dei
// rimborsi (eliminabili, per correggere un errore). E' l'unico punto dell'app
// in cui si registrano rimborsi. Ricarica a ogni ingresso nella tab
// (ionViewWillEnter, non ngOnInit): le pagine di una shell a tab restano
// montate, quindi senza questo una spesa creata da un'altra tab non
// comparirebbe nei saldi.
@Component({
  selector: 'app-balances',
  templateUrl: './balances.page.html',
  standalone: true,
  imports: [
    AmountPipe,
    DatePipe,
    ExpenseBalancesComponent,
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar,
    TranslatePipe,
  ],
})
export class BalancesPage {
  private authService = inject(AuthService);
  private expenseService = inject(ExpenseService);
  private settlementService = inject(SettlementService);
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);

  expenses: ExpenseListItem[] = [];
  settlements: Settlement[] = [];
  loadError = false;

  constructor() {
    addIcons({ 'cash-outline': cashOutline, 'trash-outline': trashOutline });
  }

  get mePublicId(): string {
    return this.authService.currentUser()?.publicId ?? '';
  }

  ionViewWillEnter() {
    this.loadAll();
  }

  // Spese e rimborsi insieme: un saldo calcolato senza i rimborsi sarebbe
  // sbagliato, quindi se una delle due chiamate fallisce si mostra l'errore.
  loadAll(onDone?: () => void) {
    this.loadError = false;
    forkJoin({
      expenses: this.expenseService.list(),
      settlements: this.settlementService.list(),
    }).subscribe({
      next: ({ expenses, settlements }) => {
        this.expenses = expenses;
        this.settlements = settlements;
        onDone?.();
      },
      error: () => {
        this.expenses = [];
        this.settlements = [];
        this.loadError = true;
        onDone?.();
      },
    });
  }

  refresh(event: Event) {
    this.loadAll(() => (event.target as HTMLIonRefresherElement).complete());
  }

  async settle(balance: Balance) {
    const modal = await this.modalCtrl.create({
      component: SettleUpModal,
      componentProps: { balance },
    });
    await modal.present();

    const { role } = await modal.onWillDismiss();
    if (role === 'settled') {
      this.loadAll();
    }
  }

  async confirmDelete(settlement: Settlement) {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('settlements.delete-confirm'),
      message: this.translate.instant('settlements.delete-confirm-message'),
      buttons: [
        { text: this.translate.instant('settlements.cancel'), role: 'cancel' },
        { text: this.translate.instant('settlements.delete'), role: 'destructive' },
      ],
    });
    await alert.present();

    // Si aspetta la chiusura dell'alert invece di usare `handler`: Ionic
    // esegue gli handler dei bottoni fuori dalla zona di Angular, quindi quello
    // che cambia dopo (liste ricaricate, errori) non verrebbe ridisegnato.
    const { role } = await alert.onWillDismiss();
    if (role === 'destructive') {
      this.deleteSettlement(settlement);
    }
  }

  async openExpenseForm() {
    const modal = await this.modalCtrl.create({ component: ExpenseFormModal });
    await modal.present();

    const { role } = await modal.onWillDismiss();
    if (role === 'created') {
      this.loadAll();
    }
  }

  private deleteSettlement(settlement: Settlement) {
    this.settlementService.remove(settlement.publicId).subscribe({
      next: async () => {
        await this.presentToast('settlements.deleted', 'success');
        this.loadAll();
      },
      error: async () => {
        await this.presentToast('settlements.delete-error', 'danger');
      },
    });
  }

  private async presentToast(messageKey: string, color: 'success' | 'danger') {
    const toast = await this.toastCtrl.create({
      message: this.translate.instant(messageKey),
      duration: 2000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
