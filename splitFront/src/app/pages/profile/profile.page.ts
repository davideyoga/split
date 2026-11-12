import { Component, computed, inject, signal } from '@angular/core';
import {
  AlertController,
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToggle,
  IonToolbar,
  ModalController,
  NavController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  banOutline,
  languageOutline,
  logOutOutline,
  notificationsOutline,
  pencilOutline,
  personOutline,
  trashOutline,
} from 'ionicons/icons';

import { AuthService } from '../../services/auth.service';
import { AppLang, LanguageService } from '../../services/language.service';
import { needsHomeScreenInstall, PushService } from '../../services/push.service';
import { BlockedUsersModal } from './blocked-users/blocked-users.modal';
import { DeleteAccountModal } from './delete-account/delete-account.modal';
import { EditNicknameModal } from './edit-nickname/edit-nickname.modal';
import { initialOf } from '../../utils/initial';

// Profilo: chi sei (nickname modificabile), lingua (it/en, persistita da
// LanguageService), notifiche push su questo dispositivo (PushService) e
// logout con conferma. E' l'unico punto dell'app da cui si esce.
// Pagina fuori dalla shell a tab (/profile), aperta dall'icona in alto a destra
// delle pagine principali; la freccia torna da dove si e' venuti.
@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToggle,
    IonToolbar,
    TranslatePipe,
  ],
})
export class ProfilePage {
  private authService = inject(AuthService);
  private navCtrl = inject(NavController);
  private alertCtrl = inject(AlertController);
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);
  private languageService = inject(LanguageService);
  private pushService = inject(PushService);

  user = this.authService.currentUser;
  languages = this.languageService.supported;
  language = this.languageService.current;
  initial = initialOf;

  push = this.pushService.state;
  pushBusy = signal(false);
  // Perche' le push non si possono accendere qui, se e' cosi'.
  pushProblemKey = computed(() => {
    switch (this.push()) {
      case 'unsupported':
        return needsHomeScreenInstall() ? 'push.ios-install' : 'push.unsupported';
      case 'denied':
        return 'push.denied';
      default:
        return null;
    }
  });

  constructor() {
    addIcons({
      'ban-outline': banOutline,
      'language-outline': languageOutline,
      'log-out-outline': logOutOutline,
      'notifications-outline': notificationsOutline,
      'pencil-outline': pencilOutline,
      'person-outline': personOutline,
      'trash-outline': trashOutline,
    });
  }

  // La modale aggiorna da sola AuthService.currentUser, che questa pagina legge.
  async editNickname() {
    const modal = await this.modalCtrl.create({
      component: EditNicknameModal,
      componentProps: { current: this.user()?.nickName ?? '' },
    });
    await modal.present();
  }

  async openBlocked() {
    const modal = await this.modalCtrl.create({ component: BlockedUsersModal });
    await modal.present();
  }

  onLanguageChange(event: Event) {
    const lang = (event as CustomEvent<{ value?: AppLang }>).detail.value;
    if (lang) {
      this.languageService.set(lang);
    }
  }

  // ionChange arriva solo da un tocco, ed e' da li' che il browser accetta di
  // chiedere il permesso. Se non va (permesso negato, rete) l'interruttore
  // torna dov'era: il binding non lo farebbe, perche' lo stato non cambia.
  async onPushToggle(event: Event) {
    const toggle = event.target as HTMLIonToggleElement;
    const wanted = (event as CustomEvent<{ checked: boolean }>).detail.checked;
    this.pushBusy.set(true);
    try {
      if (wanted) {
        await this.pushService.enable();
      } else {
        await this.pushService.disable();
      }
    } catch {
      const toast = await this.toastCtrl.create({
        message: this.translate.instant('push.error'),
        duration: 2500,
        position: 'bottom',
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.pushBusy.set(false);
      toggle.checked = this.push() === 'on';
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

  async openDeleteAccount() {
    const modal = await this.modalCtrl.create({ component: DeleteAccountModal });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'deleted') {
      // Solo stato locale, niente signOut(): la sessione sul server non c'e' piu'.
      this.authService.logout();
      this.navCtrl.navigateRoot('/login');
    }
  }

  private logout() {
    // Prima del signOut: la richiesta deve partire col token ancora valido.
    this.pushService.forgetDevice();
    this.authService.signOut();
    // navigateRoot azzera lo stack: le tab della sessione appena chiusa non
    // restano montate, quindi un nuovo login (anche con un altro utente) non
    // ritrova i dati del precedente.
    this.navCtrl.navigateRoot('/login');
  }
}
