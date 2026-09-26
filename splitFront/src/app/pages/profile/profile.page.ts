import { Component, inject } from '@angular/core';
import {
  AlertController,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../services/auth.service';
import { AppLang, LanguageService } from '../../services/language.service';

// Tab Profilo: chi sei, lingua (it/en, persistita da LanguageService) e
// logout con conferma. E' l'unico punto dell'app da cui si esce.
@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToolbar,
    TranslatePipe,
  ],
})
export class ProfilePage {
  private authService = inject(AuthService);
  private navCtrl = inject(NavController);
  private alertCtrl = inject(AlertController);
  private translate = inject(TranslateService);
  private languageService = inject(LanguageService);

  user = this.authService.currentUser;
  languages = this.languageService.supported;
  language = this.languageService.current;

  onLanguageChange(event: Event) {
    const lang = (event as CustomEvent<{ value?: AppLang }>).detail.value;
    if (lang) {
      this.languageService.set(lang);
    }
  }

  async confirmLogout() {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('profile.logout-confirm'),
      buttons: [
        { text: this.translate.instant('profile.cancel'), role: 'cancel' },
        { text: this.translate.instant('profile.logout'), role: 'confirm' },
      ],
    });
    await alert.present();

    // Si aspetta la chiusura dell'alert invece di usare `handler`: Ionic
    // esegue gli handler dei bottoni fuori dalla zona di Angular, quindi quello
    // che cambia dopo (liste ricaricate, errori) non verrebbe ridisegnato.
    const { role } = await alert.onWillDismiss();
    if (role === 'confirm') {
      this.logout();
    }
  }

  private logout() {
    this.authService.logout();
    // navigateRoot azzera lo stack: le tab della sessione appena chiusa non
    // restano montate, quindi un nuovo login (anche con un altro utente) non
    // ritrova i dati del precedente.
    this.navCtrl.navigateRoot('/login');
  }
}
