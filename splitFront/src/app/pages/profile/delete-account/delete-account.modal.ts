import { Component, inject, OnInit } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { warningOutline } from 'ionicons/icons';
import { forkJoin } from 'rxjs';

import { MoneyPipe } from '../../../pipes/money.pipe';
import { AuthService } from '../../../services/auth.service';
import { ExpenseService } from '../../../services/expense.service';
import { SettlementService } from '../../../services/settlement.service';
import { UserService } from '../../../services/user.service';
import { computeBalances } from '../../../utils/balance';

// Schermata di sicurezza prima di cancellare l'account (2026-11-08): dice cosa
// sparisce, cosa resta e quanto e' ancora aperto nei saldi. Non si digita
// niente, basta il pulsante (decisione dell'utente). I saldi aperti avvisano ma
// non bloccano: uscire non puo' dipendere da una spesa aggiunta da altri.
// Si chiude con dismiss(null, 'deleted') o dismiss(null, 'cancel').
@Component({
  selector: 'app-delete-account',
  templateUrl: './delete-account.modal.html',
  styleUrls: ['./delete-account.modal.scss'],
  standalone: true,
  imports: [
    TranslatePipe,
    MoneyPipe,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonText,
    IonTitle,
    IonToolbar,
  ],
})
export class DeleteAccountModal implements OnInit {
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);
  private authService = inject(AuthService);
  private expenseService = inject(ExpenseService);
  private settlementService = inject(SettlementService);
  private userService = inject(UserService);

  // Il pulsante aspetta i saldi, cosi' l'avviso si legge prima di poter confermare.
  loaded = false;
  loadError = false;
  deleting = false;
  deleteError = false;
  iOweCents = 0;
  owedToMeCents = 0;

  constructor() {
    addIcons({ 'warning-outline': warningOutline });
  }

  ngOnInit() {
    forkJoin({
      expenses: this.expenseService.list(),
      settlements: this.settlementService.list(),
    }).subscribe({
      next: ({ expenses, settlements }) => {
        const summary = computeBalances(expenses, this.authService.currentUser()?.publicId, settlements);
        this.iOweCents = summary.iOweCents;
        this.owedToMeCents = summary.owedToMeCents;
        this.loaded = true;
      },
      error: () => {
        this.loadError = true;
        this.loaded = true;
      },
    });
  }

  get hasOpenBalances(): boolean {
    return this.iOweCents !== 0 || this.owedToMeCents !== 0;
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    this.deleting = true;
    this.deleteError = false;
    this.userService.deleteMyAccount().subscribe({
      next: async () => {
        const toast = await this.toastCtrl.create({
          message: this.translate.instant('profile.delete.done'),
          duration: 3000,
          position: 'bottom',
          color: 'success',
        });
        await toast.present();
        await this.modalCtrl.dismiss(null, 'deleted');
      },
      error: () => {
        this.deleting = false;
        this.deleteError = true;
      },
    });
  }
}
