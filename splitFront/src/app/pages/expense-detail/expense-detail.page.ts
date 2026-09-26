import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
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
import { createOutline, trashOutline } from 'ionicons/icons';

import { CATEGORY_ICONS } from '../../models/category.model';
import { AuthService } from '../../services/auth.service';
import { ExpenseListItem, ExpenseService } from '../../services/expense.service';
import { AmountPipe } from '../../pipes/amount.pipe';
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
  standalone: true,
  imports: [
    AmountPipe,
    CommonModule,
    TranslatePipe,
    IonBackButton,
    IonButton,
    IonButtons,
    IonChip,
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

  expense: ExpenseListItem | null = null;
  loadError = false;
  notFound = false;

  groupPublicId = '';
  backHref = '/tabs/activity';
  mePublicId = this.authService.currentUser()?.publicId ?? '';
  canEdit = false;
  deleting = false;

  constructor() {
    // Le icone delle categorie arrivano dal DB: vanno registrate tutte.
    addIcons({
      'create-outline': createOutline,
      'trash-outline': trashOutline,
      ...CATEGORY_ICONS,
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
    this.canEdit = expense.expenseContributions.some(
      (c) => c.user.publicId === this.mePublicId,
    );
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
      message: this.translate.instant('expense-detail.delete-confirm-message'),
      buttons: [
        { text: this.translate.instant('expense-detail.cancel'), role: 'cancel' },
        {
          text: this.translate.instant('expense-detail.delete'),
          role: 'destructive',
          handler: () => this.deleteExpense(),
        },
      ],
    });
    await alert.present();
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
