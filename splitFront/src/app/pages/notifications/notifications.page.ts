import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  createOutline,
  notificationsOutline,
  peopleOutline,
  receiptOutline,
  removeCircleOutline,
  swapHorizontalOutline,
  trashOutline,
} from 'ionicons/icons';

import { LoadingSkeletonComponent } from '../../components/loading-skeleton/loading-skeleton.component';
import { SMART_SPLIT_SLUG } from '../../models/category.model';
import { AppNotification } from '../../models/notification.model';
import { MoneyPipe } from '../../pipes/money.pipe';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { toCents } from '../../utils/balance';
import { UserNamePipe } from '../../pipes/user-name.pipe';

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
@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: true,
  imports: [
    UserNamePipe,
    DatePipe,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
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

  rows: NotificationRow[] = [];
  loaded = false;
  loadError = false;
  // Non lette quando sono arrivate: il server le segna subito come lette, ma
  // qui restano evidenziate per tutta la visita.
  highlighted = new Set<string>();

  constructor() {
    addIcons({
      'create-outline': createOutline,
      'notifications-outline': notificationsOutline,
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

  load(onDone?: () => void) {
    this.loadError = false;
    this.notificationService.list().subscribe({
      next: (notifications) => {
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
      row.icon = n.type === 'EXPENSE_ADDED' ? 'receipt-outline' : 'create-outline';
      row.key = `notifications.type.${n.type}`;
      row.link = n.expense ? ['/tabs/activity/expense', n.expense.publicId] : null;
      break;
    case 'EXPENSE_REMOVED':
    case 'EXPENSE_DELETED':
      row.icon = n.type === 'EXPENSE_REMOVED' ? 'remove-circle-outline' : 'trash-outline';
      row.key = `notifications.type.${n.type}`;
      break;
    // GROUP_ADDED non si crea piu' (si entra solo col link), ma le vecchie restano.
    case 'GROUP_ADDED':
    case 'GROUP_JOINED':
      row.icon = 'people-outline';
      row.key = `notifications.type.${n.type}`;
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
