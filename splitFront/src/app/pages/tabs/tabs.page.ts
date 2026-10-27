import { Component, ViewChild } from '@angular/core';
import {
  IonIcon,
  IonLabel,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { peopleOutline, receiptOutline, swapHorizontalOutline } from 'ionicons/icons';

// Shell a tab persistente: resta montata su tutti i livelli 1 e 2 della
// gerarchia (vedi app.routes.ts). Le pagine figlie vengono renderizzate
// nell'outlet interno di <ion-tabs>. Il Profilo non e' una tab: e' l'icona in
// alto a destra delle pagine principali (components/profile-button).
@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, TranslatePipe],
})
export class TabsPage {
  @ViewChild(IonTabs) private tabs?: IonTabs;
  private entered = false;

  constructor() {
    addIcons({
      'receipt-outline': receiptOutline,
      'people-outline': peopleOutline,
      'swap-horizontal-outline': swapHorizontalOutline,
    });
  }

  // Profilo e Notifiche sono pagine fuori dalla shell: tornando indietro Ionic
  // manda ionViewWillEnter alla shell, non alla tab visibile, che quindi non
  // ricaricava (es. spese appena accettate dalle Notifiche che non comparivano
  // in Attivita'). Lo si inoltra alla pagina attiva. Alla prima entrata no:
  // li' ci pensa gia' Ionic.
  ionViewWillEnter() {
    if (!this.entered) {
      this.entered = true;
      return;
    }
    const outlet = this.tabs?.outlet;
    const page = outlet?.isActivated
      ? (outlet.component as { ionViewWillEnter?: () => void })
      : null;
    page?.ionViewWillEnter?.();
  }
}
