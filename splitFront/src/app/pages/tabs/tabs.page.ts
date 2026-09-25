import { Component } from '@angular/core';
import {
  IonIcon,
  IonLabel,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  peopleOutline,
  personCircleOutline,
  receiptOutline,
  swapHorizontalOutline,
} from 'ionicons/icons';

// Shell a tab persistente: resta montata su tutti i livelli 1 e 2 della
// gerarchia (vedi app.routes.ts). Le pagine figlie vengono renderizzate
// nell'outlet interno di <ion-tabs>.
@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, TranslatePipe],
})
export class TabsPage {
  constructor() {
    addIcons({
      'receipt-outline': receiptOutline,
      'people-outline': peopleOutline,
      'swap-horizontal-outline': swapHorizontalOutline,
      'person-circle-outline': personCircleOutline,
    });
  }
}
