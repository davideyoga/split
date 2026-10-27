import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin, Observable } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  closeCircleOutline,
  createOutline,
  hourglassOutline,
  notificationsOutline,
  personAddOutline,
  peopleOutline,
  receiptOutline,
  removeCircleOutline,
  swapHorizontalOutline,
  trashOutline,
} from 'ionicons/icons';

import { LoadingSkeletonComponent } from '../../components/loading-skeleton/loading-skeleton.component';
import { SMART_SPLIT_SLUG } from '../../models/category.model';
import { AppNotification } from '../../models/notification.model';
import { User } from '../../models/user.model';
import { AmountPipe } from '../../pipes/amount.pipe';
import { MoneyPipe } from '../../pipes/money.pipe';
import { AuthService } from '../../services/auth.service';
import { FriendRequests, FriendService, PendingExpense } from '../../services/friend.service';
import { ExpenseService } from '../../services/expense.service';
import { GroupService } from '../../services/group.service';
import { NotificationService } from '../../services/notification.service';
import { toCents } from '../../utils/balance';

// Una riga della lista, gia' pronta per il template.
interface NotificationRow {
  publicId: string;
  createdDate: string;
  icon: string;
  // `notifications.type.<...>`, tradotta coi parametri qui sotto.
  key: string;
  actor: string | null;
  // '' = senza descrizione: si mostra `fallbackKey`, come nelle liste di spese.
  description: string;
  fallbackKey: string;
  cents: number | null;
  currency: string;
  group: string;
  // null = non si apre (spesa eliminata, o da cui si e' stati tolti).
  link: string[] | null;
}

// Notifiche (/notifications), fuori dalla shell a tab come il Profilo: si apre
// dalla campanella in alto a destra e la freccia torna da dove si e' venuti.
// Aprendola, le non lette mostrate diventano lette e il numero si azzera
// (decisione dell'utente, 2026-10-25); restano evidenziate finche' non si esce.
// In cima le richieste ancora da decidere (amici, 2026-10-25): restano finche'
// non si accetta o rifiuta, anche dopo aver letto la notifica.
@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: true,
  imports: [
    AmountPipe,
    DatePipe,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar,
    LoadingSkeletonComponent,
    MoneyPipe,
    RouterLink,
    TranslatePipe,
  ],
})
export class NotificationsPage {
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);
  private friendService = inject(FriendService);
  private expenseService = inject(ExpenseService);
  private groupService = inject(GroupService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);

  requests: FriendRequests = { people: [], groups: [] };
  // Una risposta alla volta: le richieste si ricaricano dopo ognuna.
  answering = false;
  rows: NotificationRow[] = [];
  loaded = false;
  loadError = false;
  // Non lette quando sono arrivate: il server le segna subito come lette, ma
  // qui restano evidenziate per tutta la visita.
  highlighted = new Set<string>();

  constructor() {
    addIcons({
      'close-circle-outline': closeCircleOutline,
      'create-outline': createOutline,
      'hourglass-outline': hourglassOutline,
      'notifications-outline': notificationsOutline,
      'person-add-outline': personAddOutline,
      'people-outline': peopleOutline,
      'receipt-outline': receiptOutline,
      'remove-circle-outline': removeCircleOutline,
      'swap-horizontal-outline': swapHorizontalOutline,
      'trash-outline': trashOutline,
    });
  }

  ionViewWillEnter() {
    this.load();
  }

  ionViewDidLeave() {
    this.highlighted.clear();
  }

  get hasRequests(): boolean {
    return this.requests.people.length > 0 || this.requests.groups.length > 0;
  }

  load(onDone?: () => void) {
    this.loadError = false;
    forkJoin({
      notifications: this.notificationService.list(),
      requests: this.friendService.requests(),
    }).subscribe({
      next: ({ notifications, requests }) => {
        this.requests = requests;
        const me = this.authService.currentUser()?.publicId ?? '';
        this.rows = notifications.map((n) => toRow(n, me));

        // Solo quelle mostrate, non "tutte": una arrivata nel frattempo resta
        // da leggere.
        const unread = notifications.filter((n) => !n.read).map((n) => n.publicId);
        unread.forEach((id) => this.highlighted.add(id));
        if (unread.length > 0) {
          this.notificationService.markRead(unread).subscribe({ error: () => undefined });
        }

        this.loaded = true;
        onDone?.();
      },
      error: () => {
        this.loadError = true;
        this.loaded = true;
        onDone?.();
      },
    });
  }

  refresh(event: Event) {
    this.load(() => (event.target as HTMLIonRefresherElement).complete());
  }

  // Accetta la persona: si diventa amici e contano tutte le sue spese in attesa.
  acceptPerson(user: User) {
    this.answer(this.friendService.accept(user.publicId), 'notifications.accepted');
  }

  async confirmRejectExpense(user: User, expense: PendingExpense) {
    const confirmed = await this.confirm(
      'notifications.reject-expense-confirm',
      'notifications.reject-expense-message',
      { description: expense.description || this.translate.instant(fallbackKeyOf(expense.categorySlug)), name: user.nickName },
    );
    if (confirmed) {
      this.answer(this.expenseService.reject(expense.publicId), 'notifications.rejected');
    }
  }

  // Entrando si diventa amici di tutti i membri del gruppo.
  acceptGroup(publicId: string) {
    this.answer(this.groupService.acceptInvitation(publicId), 'notifications.group-accepted');
  }

  async confirmDeclineGroup(publicId: string, name: string) {
    const confirmed = await this.confirm(
      'notifications.decline-group-confirm',
      'notifications.decline-group-message',
      { group: name },
    );
    if (confirmed) {
      this.answer(this.groupService.declineInvitation(publicId), 'notifications.group-declined');
    }
  }

  fallbackKey(expense: PendingExpense): string {
    return fallbackKeyOf(expense.categorySlug);
  }

  private answer(request: Observable<unknown>, successKey: string) {
    if (this.answering) {
      return;
    }
    this.answering = true;
    request.subscribe({
      next: async () => {
        this.answering = false;
        await this.presentToast(successKey, 'success');
        this.load();
        this.notificationService.refreshCount();
      },
      error: async () => {
        this.answering = false;
        await this.presentToast('notifications.answer-error', 'danger');
        this.load();
      },
    });
  }

  // Conferma con i soli ruoli dei bottoni: gli `handler` di Ionic girano fuori
  // dalla zona di Angular (vedi CLAUDE.md, pitfall degli alert).
  private async confirm(headerKey: string, messageKey: string, params: Record<string, string>) {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant(headerKey, params),
      message: this.translate.instant(messageKey, params),
      buttons: [
        { text: this.translate.instant('notifications.cancel'), role: 'cancel' },
        { text: this.translate.instant('notifications.reject'), role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onWillDismiss();
    return role === 'destructive';
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

// Titolo di una spesa senza descrizione, come nelle liste di spese.
function fallbackKeyOf(categorySlug: string | null): string {
  return categorySlug === SMART_SPLIT_SLUG ? 'categories.smart-split' : 'expense-detail.untitled';
}

function toRow(n: AppNotification, mePublicId: string): NotificationRow {
  const row: NotificationRow = {
    publicId: n.publicId,
    createdDate: n.createdDate,
    icon: 'notifications-outline',
    key: 'notifications.type.unknown',
    actor: n.actor?.nickName ?? null,
    description: '',
    fallbackKey: 'expense-detail.untitled',
    cents: null,
    currency: 'EUR',
    group: '',
    link: null,
  };

  // La spesa: quella attuale se c'e' ancora, altrimenti l'istantanea.
  const expense = n.expense ?? n.params;
  if (expense) {
    row.description = expense.description;
    row.fallbackKey = fallbackKeyOf(expense.categorySlug);
    row.cents = toCents(expense.amount);
    row.currency = expense.currency;
  }

  switch (n.type) {
    case 'EXPENSE_ADDED':
    case 'EXPENSE_UPDATED':
    case 'EXPENSE_PENDING':
    case 'EXPENSE_REJECTED':
      row.icon = {
        EXPENSE_ADDED: 'receipt-outline',
        EXPENSE_UPDATED: 'create-outline',
        EXPENSE_PENDING: 'hourglass-outline',
        EXPENSE_REJECTED: 'close-circle-outline',
      }[n.type];
      row.key = `notifications.type.${n.type}`;
      // EXPENSE_PENDING apre il dettaglio, dove si accetta o rifiuta.
      row.link = n.expense ? ['/tabs/activity/expense', n.expense.publicId] : null;
      break;
    case 'FRIEND_ACCEPTED':
      row.icon = 'person-add-outline';
      row.key = 'notifications.type.FRIEND_ACCEPTED';
      break;
    case 'GROUP_INVITED':
    case 'GROUP_JOINED':
    case 'GROUP_DECLINED':
      row.icon = 'people-outline';
      row.key = `notifications.type.${n.type}`;
      row.group = n.group?.name ?? '';
      // L'invito si accetta dalla sezione Richieste: il gruppo non si apre
      // finche' non si e' membri.
      row.link = n.group && n.type !== 'GROUP_INVITED' ? ['/tabs/groups', n.group.publicId] : null;
      break;
    case 'EXPENSE_REMOVED':
    case 'EXPENSE_DELETED':
      row.icon = n.type === 'EXPENSE_REMOVED' ? 'remove-circle-outline' : 'trash-outline';
      row.key = `notifications.type.${n.type}`;
      break;
    case 'GROUP_ADDED':
      row.icon = 'people-outline';
      row.key = 'notifications.type.GROUP_ADDED';
      row.group = n.group?.name ?? '';
      row.link = n.group ? ['/tabs/groups', n.group.publicId] : null;
      break;
    case 'SETTLEMENT_ADDED':
      if (n.settlement) {
        row.icon = 'swap-horizontal-outline';
        row.key =
          n.settlement.to.publicId === mePublicId
            ? 'notifications.type.SETTLEMENT_ADDED_TO_ME'
            : 'notifications.type.SETTLEMENT_ADDED_FROM_ME';
        row.cents = toCents(n.settlement.amount);
        row.currency = n.settlement.currency;
        row.link = ['/tabs/balances'];
      }
      break;
  }
  return row;
}
