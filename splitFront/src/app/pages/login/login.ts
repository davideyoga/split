import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonItem, IonList, IonButton, IonInput, IonText, NavController } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';

// Codici di errore di Better Auth (plugin emailOTP) -> chiavi i18n.
const ERROR_KEYS: Record<string, string> = {
  INVALID_OTP: 'login.invalid-code',
  OTP_EXPIRED: 'login.code-expired',
  TOO_MANY_ATTEMPTS: 'login.too-many-attempts',
};

/**
 * Login in due passaggi: email -> codice di 6 cifre ricevuto per email.
 * Un'email non registrata passa comunque al secondo passaggio (il backend
 * risponde ok senza mandare nulla), e il codice risulta poi non valido.
 */
@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonContent, IonHeader, IonTitle, IonToolbar, IonItem, IonList, IonButton, IonInput, IonText, TranslatePipe]
})
export class Login {

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private languageService = inject(LanguageService);
  private route = inject(ActivatedRoute);
  private navCtrl = inject(NavController);

  step: 'email' | 'code' = 'email';
  busy = false;
  errorMessage = '';
  infoMessage = '';

  emailForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  codeForm = this.fb.group({
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  get email(): string {
    return this.emailForm.value.email?.trim().toLowerCase() ?? '';
  }

  sendCode() {
    if (this.emailForm.invalid || this.busy) {
      return;
    }
    this.requestCode(() => {
      this.step = 'code';
      this.codeForm.reset();
    });
  }

  resendCode() {
    if (this.busy) {
      return;
    }
    this.requestCode(() => {
      this.codeForm.reset();
      this.infoMessage = 'login.code-resent';
    });
  }

  submitCode() {
    const otp = this.codeForm.value.otp?.trim();
    if (this.codeForm.invalid || !otp || this.busy) {
      return;
    }
    this.busy = true;
    this.errorMessage = '';
    this.infoMessage = '';

    this.authService.verifyCode(this.email, otp).subscribe({
      // navigateRoot: la shell riparte da zero, senza pagine della sessione
      // precedente nello stack.
      next: () => {
        this.busy = false;
        this.navCtrl.navigateRoot(this.returnUrl());
      },
      error: (err: unknown) => {
        this.busy = false;
        this.errorMessage = this.errorKey(err);
      }
    });
  }

  changeEmail() {
    this.step = 'email';
    this.errorMessage = '';
    this.infoMessage = '';
  }

  private requestCode(onSent: () => void) {
    this.busy = true;
    this.errorMessage = '';
    this.infoMessage = '';

    this.authService.requestCode(this.email, this.languageService.current()).subscribe({
      next: () => {
        this.busy = false;
        onSent();
      },
      error: (err: unknown) => {
        this.busy = false;
        this.errorMessage = this.errorKey(err);
      }
    });
  }

  private errorKey(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 429) {
        return 'login.rate-limited';
      }
      const code = (err.error as { code?: string } | null)?.code;
      if (code && ERROR_KEYS[code]) {
        return ERROR_KEYS[code];
      }
    }
    return 'login.generic-error';
  }

  // returnUrl arriva dalla guard (deep link senza sessione) o dall'interceptor
  // (401). Solo percorsi interni: niente URL assoluti o protocol-relative
  // ("//host"), per non trasformare il login in un open redirect.
  private returnUrl(): string {
    const url = this.route.snapshot.queryParamMap.get('returnUrl');
    if (url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/login')) {
      return url;
    }
    return '/tabs/activity';
  }
}
