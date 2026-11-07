import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonItem, IonList, IonButton, IonIcon, IonInput, IonText, NavController } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { logoApple } from 'ionicons/icons';
import { Observable } from 'rxjs';

import { User } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { SocialSignInService } from '../../services/social-sign-in.service';
import { safeReturnUrl } from '../../utils/return-url';

// Codici di errore di Better Auth (plugin emailOTP, login social) e del nostro
// hook di registrazione (auth.factory.ts) -> chiavi i18n.
const ERROR_KEYS: Record<string, string> = {
  INVALID_OTP: 'login.invalid-code',
  OTP_EXPIRED: 'login.code-expired',
  TOO_MANY_ATTEMPTS: 'login.too-many-attempts',
  SIGN_UP_DISABLED: 'login.social-no-account',
};

// OAUTH_LINK_ERROR copre piu' casi, distinti solo dal messaggio. Questo e'
// "email gia' registrata, ma non collegabile": non verificata dal provider, o
// account locale mai confermato (si conferma con un login col codice).
const NOT_LINKED_MESSAGE = 'account not linked';

/**
 * Login in due passaggi: email -> codice di 6 cifre ricevuto per email. Con la
 * registrazione aperta un'email nuova riceve il codice come le altre, e il
 * primo codice valido crea l'account; con quella chiusa passa comunque al
 * secondo passaggio (il backend risponde ok senza mandare nulla), e il codice
 * risulta poi non valido.
 * In alternativa Google o Apple, se configurati (environment): stessa email =
 * stesso account. Un account nuovo passa da /welcome a scegliere il nickname.
 */
@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonContent, IonHeader, IonTitle, IonToolbar, IonItem, IonList, IonButton, IonIcon, IonInput, IonText, TranslatePipe]
})
export class Login {

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private languageService = inject(LanguageService);
  private route = inject(ActivatedRoute);
  private navCtrl = inject(NavController);
  readonly social = inject(SocialSignInService);

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

  constructor() {
    addIcons({ logoApple });
  }

  // Il contenitore del pulsante di Google esiste solo nel passaggio "email":
  // lo si ridisegna ogni volta che ricompare ("Usa un'altra email").
  @ViewChild('googleButton') set googleButton(ref: ElementRef<HTMLElement> | undefined) {
    if (!ref) {
      return;
    }
    this.social
      .renderGoogleButton(ref.nativeElement, this.languageService.current(), (idToken) =>
        this.signInWith(this.authService.signInWithIdToken('google', idToken)),
      )
      .catch(() => {
        this.errorMessage = 'login.social-unavailable';
      });
  }

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
    this.signInWith(this.authService.verifyCode(this.email, otp));
  }

  async signInWithApple() {
    if (this.busy) {
      return;
    }
    this.errorMessage = '';
    try {
      const result = await this.social.signInWithApple();
      if (result) {
        this.signInWith(this.authService.signInWithIdToken('apple', result.idToken, result.user));
      }
    } catch {
      this.errorMessage = 'login.social-unavailable';
    }
  }

  changeEmail() {
    this.step = 'email';
    this.errorMessage = '';
    this.infoMessage = '';
  }

  private signInWith(signIn: Observable<User>) {
    this.busy = true;
    this.errorMessage = '';
    this.infoMessage = '';

    signIn.subscribe({
      // navigateRoot: la shell riparte da zero, senza pagine della sessione
      // precedente nello stack. Un account appena creato passa prima da
      // /welcome (lo farebbe anche l'authGuard, qui si evita un giro).
      next: (user) => {
        this.busy = false;
        const returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
        if (user.needsName) {
          this.navCtrl.navigateRoot(['/welcome'], { queryParams: { returnUrl } });
        } else {
          this.navCtrl.navigateRoot(returnUrl);
        }
      },
      error: (err: unknown) => {
        this.busy = false;
        this.errorMessage = this.errorKey(err);
      }
    });
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
      const body = err.error as { code?: string; message?: string } | null;
      if (body?.code === 'OAUTH_LINK_ERROR' && body.message === NOT_LINKED_MESSAGE) {
        return 'login.social-not-linked';
      }
      if (body?.code && ERROR_KEYS[body.code]) {
        return ERROR_KEYS[body.code];
      }
    }
    return 'login.generic-error';
  }
}
