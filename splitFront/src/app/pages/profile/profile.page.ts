import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  AlertController,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../services/auth.service';

// Tab Profilo (versione minima). Il selettore lingua (LanguageService) e la
// gestione del 401 arrivano nella fase 4: per ora la pagina mostra chi sei e
// centralizza il logout, che esce cosi' dall'header di Attivita'.
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
    IonTitle,
    IonToolbar,
    TranslatePipe,
  ],
})
export class ProfilePage {
  private authService = inject(AuthService);
  private router = inject(Router);
  private alertCtrl = inject(AlertController);
  private translate = inject(TranslateService);

  user = this.authService.currentUser;

  async confirmLogout() {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('profile.logout-confirm'),
      buttons: [
        { text: this.translate.instant('profile.cancel'), role: 'cancel' },
        {
          text: this.translate.instant('profile.logout'),
          role: 'confirm',
          handler: () => this.logout(),
        },
      ],
    });
    await alert.present();
  }

  private logout() {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
