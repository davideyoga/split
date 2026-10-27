import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonBadge, IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { notificationsOutline } from 'ionicons/icons';

import { NotificationService } from '../../services/notification.service';

// Campanella in alto a destra, accanto all'icona del Profilo, nell'header delle
// tre pagine principali: apre /notifications (fuori dalla shell, come il
// Profilo). Il numero lo tiene NotificationService; le pagine lo ricaricano nel
// loro ionViewWillEnter, perche' gli hook di Ionic non arrivano a un componente
// figlio. Come profile-button, va messa dentro un <ion-buttons slot="end">.
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [IonBadge, IonButton, IonIcon, RouterLink, TranslatePipe],
  template: `
    <ion-button
      routerLink="/notifications"
      [attr.aria-label]="
        count() > 0
          ? ('notifications.bell-unread' | translate: { count: count() })
          : ('notifications.bell' | translate)
      "
    >
      <ion-icon slot="icon-only" name="notifications-outline"></ion-icon>
      @if (count() > 0) {
        <ion-badge color="danger" aria-hidden="true">{{ label() }}</ion-badge>
      }
    </ion-button>
  `,
  styles: `
    ion-button {
      position: relative;
    }

    /* Sull'angolo in alto a destra dell'icona, senza coprirla. */
    ion-badge {
      position: absolute;
      top: -4px;
      inset-inline-end: -6px;
      min-width: 18px;
      padding: 3px 5px;
      border-radius: 9px;
      font-size: 11px;
      pointer-events: none;
    }
  `,
})
export class NotificationBellComponent {
  private notificationService = inject(NotificationService);

  readonly count = this.notificationService.unreadCount;
  // Oltre 9 il numero esatto non serve e allargherebbe il badge.
  readonly label = computed(() => (this.count() > 9 ? '9+' : String(this.count())));

  constructor() {
    addIcons({ 'notifications-outline': notificationsOutline });
  }
}
