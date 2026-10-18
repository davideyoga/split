import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { personCircleOutline } from 'ionicons/icons';

// Icona del Profilo in alto a destra, solo nell'header delle tre pagine
// principali (Attivita', Gruppi, Saldi): il Profilo non e' piu' una tab ma una
// pagina fuori dalla shell (/profile). Va messa dentro un <ion-buttons
// slot="end">, che resta nella pagina: lo slot deve stare su un figlio diretto
// di <ion-toolbar>.
@Component({
  selector: 'app-profile-button',
  standalone: true,
  imports: [IonButton, IonIcon, RouterLink, TranslatePipe],
  template: `
    <ion-button routerLink="/profile" [attr.aria-label]="'profile.title' | translate">
      <ion-icon slot="icon-only" name="person-circle-outline"></ion-icon>
    </ion-button>
  `,
})
export class ProfileButtonComponent {
  constructor() {
    addIcons({ 'person-circle-outline': personCircleOutline });
  }
}
