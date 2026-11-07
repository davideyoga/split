import { Component, inject, OnInit } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonText,
  IonTitle,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { User } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { safeReturnUrl } from '../../utils/return-url';
import { NicknameField } from '../profile/edit-nickname/nickname-field';

// Nickname provvisorio di chi si registra col codice: `user` + 8 cifre (vedi
// splitBack/src/app/auth/provisional-nickname.ts). Non lo si propone: quello
// ricavato dal nome di Google/Apple si', perche' e' gia' un nome.
const PLACEHOLDER_NICKNAME = /^user\d{8}$/;

/**
 * Dopo la registrazione (codice, Google o Apple): il nuovo utente sceglie il
 * nickname, poi va al `returnUrl`. Ci si arriva dall'authGuard finche'
 * `needsName` e' vero; fuori dalla shell a tab, come il login.
 */
@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.page.html',
  styleUrls: ['./welcome.page.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    IonButton,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonList,
    IonText,
    IonTitle,
    IonToolbar,
  ],
})
export class WelcomePage implements OnInit {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private route = inject(ActivatedRoute);
  private navCtrl = inject(NavController);

  readonly field = new NicknameField();
  // Il form serve solo a ngSubmit (Invio dalla tastiera e pulsante).
  readonly form = new FormGroup({ nickName: this.field.control });
  saving = false;

  ngOnInit() {
    const current = this.authService.currentUser()?.nickName ?? '';
    if (!PLACEHOLDER_NICKNAME.test(current)) {
      this.field.control.setValue(current, { emitEvent: false });
    }
  }

  // Si puo' tenere quello proposto: anche uguale al provvisorio, il PATCH
  // chiude `needsName`.
  get canSave(): boolean {
    return !this.saving && this.field.control.valid;
  }

  save() {
    if (!this.canSave) {
      this.field.onBlur();
      return;
    }

    this.saving = true;
    this.userService.updateMyNickname(this.field.value).subscribe({
      next: (user: User) => {
        this.authService.updateCurrentUser({ ...this.authService.currentUser(), ...user, needsName: false });
        this.navCtrl.navigateRoot(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
      },
      error: (err: HttpErrorResponse) => {
        this.saving = false;
        this.field.setServerError(err.error?.code);
      },
    });
  }

  // Registrato con l'email o l'account sbagliato: si esce e si riparte.
  useAnotherAccount() {
    this.authService.signOut();
    this.navCtrl.navigateRoot('/login');
  }
}
