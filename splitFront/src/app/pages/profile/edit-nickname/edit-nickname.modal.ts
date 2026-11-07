import { Component, inject, Input, OnInit } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { User } from '../../../models/user.model';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { NicknameField } from './nickname-field';

// Cambio del nickname, aperta dal Profilo. Campo e messaggi d'errore in
// NicknameField (gli stessi di /welcome). Chiude con dismiss(user, 'updated')
// dopo il toast, o dismiss(null, 'cancel'), come le altre modali.
@Component({
  selector: 'app-edit-nickname',
  templateUrl: './edit-nickname.modal.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonList,
    IonTitle,
    IonToolbar,
  ],
})
export class EditNicknameModal implements OnInit {
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);
  private userService = inject(UserService);
  private authService = inject(AuthService);

  @Input() current = '';

  readonly field = new NicknameField();
  saving = false;

  get canSave(): boolean {
    return !this.saving && this.field.control.valid && this.field.value !== this.current;
  }

  ngOnInit() {
    // Senza evento: un nickname di prima delle regole non mostra errori finche'
    // non lo si tocca.
    this.field.control.setValue(this.current, { emitEvent: false });
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  save() {
    if (!this.canSave) {
      this.field.onBlur();
      return;
    }

    this.saving = true;
    this.userService.updateMyNickname(this.field.value).subscribe({
      next: async (user: User) => {
        this.authService.updateCurrentUser({ ...this.authService.currentUser(), ...user });
        const toast = await this.toastCtrl.create({
          message: this.translate.instant('profile.nickname-updated'),
          duration: 2000,
          position: 'bottom',
          color: 'success',
        });
        await toast.present();
        this.modalCtrl.dismiss(user, 'updated');
      },
      error: (err: HttpErrorResponse) => {
        this.saving = false;
        this.field.setServerError(err.error?.code);
      },
    });
  }
}
