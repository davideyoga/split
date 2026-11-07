import { Component, inject, OnInit } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LoadingSkeletonComponent } from '../../../components/loading-skeleton/loading-skeleton.component';
import { User } from '../../../models/user.model';
import { UserService } from '../../../services/user.service';
import { initialOf } from '../../../utils/initial';

// Le persone bloccate (2026-11-07), dal Profilo: si sbloccano da qui. Si
// blocca invece toccando un partecipante nel dettaglio di una spesa.
@Component({
  selector: 'app-blocked-users',
  templateUrl: './blocked-users.modal.html',
  standalone: true,
  imports: [
    TranslatePipe,
    LoadingSkeletonComponent,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonTitle,
    IonToolbar,
  ],
})
export class BlockedUsersModal implements OnInit {
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);
  private userService = inject(UserService);

  blocked: User[] = [];
  loaded = false;
  loadError = false;
  initial = initialOf;

  ngOnInit() {
    this.userService.getBlocked().subscribe({
      next: (users) => {
        this.blocked = users;
        this.loaded = true;
      },
      error: () => {
        this.loadError = true;
        this.loaded = true;
      },
    });
  }

  close() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  unblock(person: User) {
    this.userService.unblock(person.publicId).subscribe({
      next: () => {
        this.blocked = this.blocked.filter((u) => u.publicId !== person.publicId);
        this.presentToast('block.unblocked', 'success', { name: person.nickName });
      },
      error: () => this.presentToast('block.error', 'danger'),
    });
  }

  private async presentToast(messageKey: string, color: 'success' | 'danger', params: Record<string, string> = {}) {
    const toast = await this.toastCtrl.create({
      message: this.translate.instant(messageKey, params),
      duration: 2000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
