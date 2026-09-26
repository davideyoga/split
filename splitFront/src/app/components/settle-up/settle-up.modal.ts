import { Component, inject, Input, OnInit } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../services/auth.service';
import { SettlementService } from '../../services/settlement.service';
import { Balance, formatCents, toCents } from '../../utils/balance';

// Registra un rimborso con la controparte di un saldo, aperta dal bottone
// "Salda" della tab Saldi. La direzione viene dal segno del saldo (se la
// controparte mi deve, e' lei a dare i soldi a me), l'importo parte dal saldo
// intero ma si puo' cambiare: meno = rimborso parziale, di piu' = il debito
// passa dall'altra parte (si avvisa, ma si puo' registrare).
// Chiude con `dismiss(rimborso, 'settled')` o `dismiss(null, 'cancel')`.
@Component({
  selector: 'app-settle-up',
  templateUrl: './settle-up.modal.html',
  styleUrls: ['./settle-up.modal.scss'],
  standalone: true,
  imports: [
    TranslatePipe,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonList,
    IonText,
    IonTitle,
    IonToolbar,
  ],
})
export class SettleUpModal implements OnInit {
  @Input({ required: true }) balance!: Balance;

  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);
  private authService = inject(AuthService);
  private settlementService = inject(SettlementService);

  // Importo digitato, come stringa (stessa pulizia di ExpenseFormModal).
  amount = '';
  note = '';
  saving = false;
  errorMessage = '';

  format = formatCents;

  ngOnInit() {
    this.amount = formatCents(this.balance.cents);
  }

  // Saldo > 0 = la controparte mi deve, quindi e' lei a pagare.
  get theyPay(): boolean {
    return this.balance.cents > 0;
  }

  get amountCents(): number {
    return /^\d+(\.\d{1,2})?$/.test(this.amount) ? toCents(this.amount) : 0;
  }

  get amountInvalid(): boolean {
    return this.amountCents < 1;
  }

  get exceedsBalance(): boolean {
    return this.amountCents > Math.abs(this.balance.cents);
  }

  get canSave(): boolean {
    return !this.amountInvalid && !this.saving;
  }

  sanitizeAmountInput(event: Event) {
    const detail = (event as CustomEvent<{ value?: string | null }>).detail;
    let value = (detail.value ?? '').replace(',', '.').replace(/[^0-9.]/g, '');

    const firstDot = value.indexOf('.');
    if (firstDot !== -1) {
      value = value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, '');
    }

    this.amount = value;
  }

  onNoteInput(event: Event) {
    this.note = (event as CustomEvent<{ value?: string | null }>).detail.value ?? '';
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  save() {
    const mePublicId = this.authService.currentUser()?.publicId;
    if (!this.canSave || !mePublicId) {
      return;
    }

    const counterpart = this.balance.user.publicId;
    this.errorMessage = '';
    this.saving = true;

    this.settlementService.create({
      fromPublicId: this.theyPay ? counterpart : mePublicId,
      toPublicId: this.theyPay ? mePublicId : counterpart,
      amount: this.amountCents / 100,
      note: this.note.trim() || undefined,
    }).subscribe({
      next: async (settlement) => {
        const toast = await this.toastCtrl.create({
          message: this.translate.instant('settlements.saved'),
          duration: 2000,
          position: 'bottom',
          color: 'success',
        });
        await toast.present();
        this.modalCtrl.dismiss(settlement, 'settled');
      },
      error: () => {
        this.saving = false;
        this.errorMessage = 'settlements.save-error';
      },
    });
  }
}
