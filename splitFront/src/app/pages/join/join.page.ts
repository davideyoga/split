import { Component, inject } from '@angular/core';
import { DatePipe, Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
  NavController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { peopleOutline } from 'ionicons/icons';

import { AuthService } from '../../services/auth.service';
import { InvitePreview, InviteService } from '../../services/invite.service';
import { INVITE_TOKEN_STORAGE_KEY, inviteErrorKey, tokenFromFragment } from '../../utils/invite';

/**
 * Pagina del link d'invito, `/join#<token>` (2026-11-07, doc/InvitiGruppo.md).
 * Fuori dalla shell a tab e senza authGuard: chi apre il link puo' non avere
 * ancora fatto login.
 *
 * - Il token dal fragment finisce in sessionStorage e sparisce dalla barra
 *   degli indirizzi; il login torna qui con returnUrl=/join, senza token.
 * - Mai un ingresso automatico: le app di chat aprono i link per l'anteprima,
 *   quindi si entra solo toccando "Unisciti".
 */
@Component({
  selector: 'app-join',
  templateUrl: './join.page.html',
  styleUrls: ['./join.page.scss'],
  standalone: true,
  imports: [
    DatePipe,
    TranslatePipe,
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonNote,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
})
export class JoinPage {
  private inviteService = inject(InviteService);
  private authService = inject(AuthService);
  private location = inject(Location);
  private navCtrl = inject(NavController);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);

  preview: InvitePreview | null = null;
  errorKey = '';
  joining = false;
  loggedIn = false;
  private token: string | null = null;

  constructor() {
    addIcons({ 'people-outline': peopleOutline });
  }

  ionViewWillEnter() {
    this.preview = null;
    this.errorKey = '';
    this.loggedIn = !!this.authService.getToken();
    this.token = this.takeToken();
    if (!this.token) {
      this.errorKey = 'join.error-not-found';
      return;
    }
    this.inviteService.preview(this.token).subscribe({
      next: (preview) => (this.preview = preview),
      error: (error: HttpErrorResponse) => (this.errorKey = inviteErrorKey(error.error?.code)),
    });
  }

  login() {
    this.navCtrl.navigateRoot(['/login'], { queryParams: { returnUrl: '/join' } });
  }

  join() {
    if (!this.token || this.joining) {
      return;
    }
    this.joining = true;
    this.inviteService.join(this.token).subscribe({
      next: async ({ groupPublicId }) => {
        this.forgetToken();
        const toast = await this.toastCtrl.create({
          message: this.translate.instant('join.joined', { group: this.preview?.groupName ?? '' }),
          duration: 2000,
          position: 'bottom',
          color: 'success',
        });
        await toast.present();
        this.navCtrl.navigateRoot(['/tabs/groups', groupPublicId]);
      },
      error: (error: HttpErrorResponse) => {
        this.joining = false;
        // Un 401 (sessione scaduta) lo gestisce l'interceptor: login e ritorno qui.
        if (error.status !== 401) {
          this.errorKey = inviteErrorKey(error.error?.code);
        }
      },
    });
  }

  openGroup() {
    if (this.preview?.groupPublicId) {
      this.forgetToken();
      this.navCtrl.navigateRoot(['/tabs/groups', this.preview.groupPublicId]);
    }
  }

  goHome() {
    this.forgetToken();
    this.navCtrl.navigateRoot(this.loggedIn ? '/tabs/groups' : '/login');
  }

  // Dal fragment (link appena aperto), altrimenti da sessionStorage (ritorno
  // dal login). Il fragment si toglie dall'URL: non resta nella cronologia ne'
  // negli screenshot.
  private takeToken(): string | null {
    const fromFragment = tokenFromFragment(window.location.hash);
    if (fromFragment) {
      try {
        sessionStorage.setItem(INVITE_TOKEN_STORAGE_KEY, fromFragment);
      } catch {
        // Senza sessionStorage il token resta solo in memoria: il login lo perde.
      }
      this.location.replaceState('/join');
      return fromFragment;
    }
    try {
      return tokenFromFragment(sessionStorage.getItem(INVITE_TOKEN_STORAGE_KEY));
    } catch {
      return null;
    }
  }

  private forgetToken() {
    try {
      sessionStorage.removeItem(INVITE_TOKEN_STORAGE_KEY);
    } catch {
      // Niente da togliere.
    }
  }
}
