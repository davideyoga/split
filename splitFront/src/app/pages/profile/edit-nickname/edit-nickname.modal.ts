import { Component, DestroyRef, inject, Input, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
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
import {
  invalidNicknameChar,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  nicknameError,
  normalizeNickname,
} from '../../../utils/nickname';

// Cambio del nickname, aperta dal Profilo. Le regole sono in utils/nickname.ts
// (copia di quelle del backend, che fanno fede); "gia' in uso" lo sa solo il
// backend (409 NICKNAME_TAKEN). Chiude con dismiss(user, 'updated') dopo il
// toast, o dismiss(null, 'cancel'), come le altre modali.
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
  private destroyRef = inject(DestroyRef);

  @Input() current = '';

  readonly min = NICKNAME_MIN_LENGTH;
  readonly max = NICKNAME_MAX_LENGTH;

  // Un FormControl e non [class.ion-invalid] a mano: Ionic mostra errorText
  // solo con ion-invalid + ion-touched sull'ion-input, e le copia lui dalle
  // classi ng-* del controllo. Messe con un binding Angular sparivano (provato:
  // errorText impostato, classi assenti, messaggio mai mostrato).
  control = new FormControl('', {
    nonNullable: true,
    validators: (c) => {
      const error = nicknameError(normalizeNickname(c.value ?? ''));
      return error ? { nickname: error } : null;
    },
  });
  errorText = '';
  saving = false;
  // Il campo e' gia' stato lasciato almeno una volta (o si e' provato a salvare).
  private blurred = false;

  get nickName(): string {
    return normalizeNickname(this.control.value);
  }

  get canSave(): boolean {
    return !this.saving && this.control.valid && this.nickName !== this.current;
  }

  ngOnInit() {
    this.control.setValue(this.current);
    this.control.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.refreshError());
  }

  onBlur() {
    this.blurred = true;
    this.refreshError();
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  save() {
    if (!this.canSave) {
      this.onBlur();
      return;
    }

    this.saving = true;
    this.userService.updateMyNickname(this.nickName).subscribe({
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
        const code = err.error?.code;
        // Resta finche' non si modifica il testo: il validator rigira e la toglie.
        this.control.setErrors({
          server: typeof code === 'string' && code.startsWith('NICKNAME_') ? code : 'SAVE_ERROR',
        });
        this.refreshError();
      },
    });
  }

  // Decide se l'errore si vede: `touched` e' cio' che Ionic guarda (con
  // l'invalid) per mostrare errorText al posto dell'helper. Gli errori si vedono
  // mentre si scrive, tranne "troppo corto", che mentre si scrive e' normale:
  // quello solo dopo aver lasciato il campo.
  // errorText e' un campo e non un getter: passa per translate.instant, che non
  // conviene rifare a ogni ciclo di change detection.
  private refreshError() {
    const errors = this.control.errors;
    const code: string | undefined = errors?.['server'] ?? errors?.['nickname'];
    const shown = !!code && (code !== 'NICKNAME_TOO_SHORT' || this.blurred);
    if (shown) {
      this.control.markAsTouched();
    } else {
      this.control.markAsUntouched();
      this.errorText = '';
      return;
    }
    const char = invalidNicknameChar(this.nickName);
    this.errorText = this.translate.instant(`profile.nickname-error.${code}`, {
      min: this.min,
      max: this.max,
      count: this.nickName.length,
      char: char === ' ' ? this.translate.instant('profile.nickname-space') : char,
    });
  }
}
