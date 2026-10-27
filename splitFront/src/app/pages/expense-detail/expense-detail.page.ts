import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonTitle,
  IonToolbar,
  ModalController,
  NavController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { createOutline, receiptOutline, trashOutline } from 'ionicons/icons';

import { CATEGORY_ICONS, isSmartSplit } from '../../models/category.model';
import { AuthService } from '../../services/auth.service';
import { ExpenseContribution, ExpenseListItem, ExpenseService } from '../../services/expense.service';
import { FriendService } from '../../services/friend.service';
import { AmountPipe } from '../../pipes/amount.pipe';
import { initialOf } from '../../utils/initial';
import { ExpenseFormModal } from '../expense-form/expense-form.modal';

// Dettaglio di una spesa. Stessa pagina su due rotte, cosi' resta nella tab da
// cui e' stata aperta:
//   /tabs/activity/expense/:expensePublicId            -> back verso Attivita'
//   /tabs/groups/:publicId/expense/:expensePublicId    -> back verso il gruppo
// Modifica (ExpenseFormModal con `expense`) ed eliminazione sono mostrate solo
// ai contributori, gli stessi a cui il backend le permette: un membro del
// gruppo senza quota vede la spesa in sola lettura.
@Component({
  selector: 'app-expense-detail',
  templateUrl: './expense-detail.page.html',
  styleUrls: ['./expense-detail.page.scss'],
  standalone: true,
  imports: [
    AmountPipe,
    CommonModule,
    TranslatePipe,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonNote,
    IonTitle,
    IonToolbar,
  ],
})
export class ExpenseDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private alertCtrl = inject(AlertController);
  private modalCtrl = inject(ModalController);
  private navCtrl = inject(NavController);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);
  private expenseService = inject(ExpenseService);
  private authService = inject(AuthService);
  private friendService = inject(FriendService);

  expense: ExpenseListItem | null = null;
  loadError = false;
  notFound = false;

  groupPublicId = '';
  backHref = '/tabs/activity';
  mePublicId = this.authService.currentUser()?.publicId ?? '';
  initial = initialOf;
  canEdit = false;
  deleting = false;
  // La mia quota, se e' ancora da accettare: chi mi ha aggiunto non e' mio
  // amico. Finche' non accetto posso solo accettare o rifiutare.
  myPending: ExpenseContribution | null = null;
  // Chi si prende la mia quota se rifiuto: chi mi ha aggiunto, se e' ancora
  // nella spesa, altrimenti il creatore (stessa regola del backend).
  rejectBearer = '';
  answering = false;
  isSmartSplit = isSmartSplit;

  constructor() {
    // Le icone delle categorie arrivano dal DB: vanno registrate tutte.
    addIcons({
      'create-outline': createOutline,
      'trash-outline': trashOutline,
      ...CATEGORY_ICONS,
      'receipt-outline': receiptOutline,
    });
  }

  ngOnInit() {
    const params = this.route.snapshot.paramMap;
    this.groupPublicId = params.get('publicId') ?? '';
    if (this.groupPublicId) {
      this.backHref = `/tabs/groups/${this.groupPublicId}`;
    }
    this.loadExpense(params.get('expensePublicId') ?? '');
  }

  private loadExpense(publicId: string) {
    this.expenseService.get(publicId).subscribe({
      next: (expense) => this.setExpense(expense),
      // 404 = eliminata (o link sbagliato), 403 = non piu' visibile a me
      // (es. tolto dalla spesa da un'altra modifica): per l'utente e' lo stesso.
      error: (err: HttpErrorResponse) => {
        if (err.status === 404 || err.status === 403) {
          this.notFound = true;
        } else {
          this.loadError = true;
        }
      },
    });
  }

  private setExpense(expense: ExpenseListItem) {
    this.expense = expense;
    const mine = expense.expenseContributions.find((c) => c.user.publicId === this.mePublicId);
    this.myPending = mine?.pending ? mine : null;
    this.canEdit = !!mine && !mine.pending;
    this.rejectBearer =
      expense.expenseContributions.find(
        (c) => !c.pending && c.user.publicId === mine?.invitedBy?.publicId,
      )?.user.nickName ?? expense.createdBy.nickName;
  }

  // Accettare la spesa vuol dire accettare chi mi ci ha messo: si diventa
  // amici e contano anche le altre sue spese in attesa.
  accept() {
    const inviter = this.myPending?.invitedBy;
    if (!this.expense || !inviter || this.answering) {
      return;
    }
    this.answering = true;
    const publicId = this.expense.publicId;
    this.friendService.accept(inviter.publicId).subscribe({
      next: async () => {
        this.answering = false;
        await this.presentToast('expense-detail.pending-accepted', 'success');
        this.loadExpense(publicId);
      },
      error: async () => {
        this.answering = false;
        await this.presentToast('expense-detail.pending-error', 'danger');
      },
    });
  }

  async confirmReject() {
    if (!this.expense || !this.myPending) {
      return;
    }
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('expense-detail.reject-confirm'),
      message: this.translate.instant('expense-detail.reject-confirm-message', {
        name: this.rejectBearer,
      }),
      buttons: [
        { text: this.translate.instant('expense-detail.cancel'), role: 'cancel' },
        { text: this.translate.instant('expense-detail.pending-reject'), role: 'destructive' },
      ],
    });
    await alert.present();
    // Come per l'eliminazione: niente `handler`, si legge il ruolo.
    const { role } = await alert.onWillDismiss();
    if (role === 'destructive') {
      this.reject();
    }
  }

  private reject() {
    if (!this.expense || this.answering) {
      return;
    }
    this.answering = true;
    this.expenseService.reject(this.expense.publicId).subscribe({
      next: async () => {
        await this.presentToast('expense-detail.rejected', 'success');
        // Non sono piu' nella spesa: non la posso piu' vedere.
        this.navCtrl.navigateBack(this.backHref);
      },
      error: async () => {
        this.answering = false;
        await this.presentToast('expense-detail.pending-error', 'danger');
      },
    });
  }

  async edit() {
    if (!this.expense) {
      return;
    }
    const modal = await this.modalCtrl.create({
      component: ExpenseFormModal,
      componentProps: { expense: this.expense },
    });
    await modal.present();

    // La modale restituisce la spesa aggiornata dal PATCH: nessun ricaricamento.
    // Le liste sotto si aggiornano da sole al ritorno (ionViewWillEnter).
    const { data, role } = await modal.onWillDismiss<ExpenseListItem>();
    if (role === 'updated' && data) {
      this.setExpense(data);
    }
  }

  async confirmDelete() {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('expense-detail.delete-confirm'),
      // Eliminare una sola spesa della divisione intelligente sposta il netto
      // di chi ci e' coinvolto: l'avviso lo dice.
      message: this.translate.instant(
        isSmartSplit(this.expense)
          ? 'expense-detail.delete-smart-split-message'
          : 'expense-detail.delete-confirm-message',
      ),
      buttons: [
        { text: this.translate.instant('expense-detail.cancel'), role: 'cancel' },
        { text: this.translate.instant('expense-detail.delete'), role: 'destructive' },
      ],
    });
    await alert.present();

    // Si aspetta la chiusura dell'alert invece di usare `handler`: Ionic
    // esegue gli handler dei bottoni fuori dalla zona di Angular, quindi quello
    // che cambia dopo (liste ricaricate, errori) non verrebbe ridisegnato.
    const { role } = await alert.onWillDismiss();
    if (role === 'destructive') {
      this.deleteExpense();
    }
  }

  private deleteExpense() {
    if (!this.expense || this.deleting) {
      return;
    }
    this.deleting = true;
    this.expenseService.remove(this.expense.publicId).subscribe({
      next: async () => {
        await this.presentToast('expense-detail.deleted', 'success');
        this.navCtrl.navigateBack(this.backHref);
      },
      error: async () => {
        this.deleting = false;
        await this.presentToast('expense-detail.delete-error', 'danger');
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
