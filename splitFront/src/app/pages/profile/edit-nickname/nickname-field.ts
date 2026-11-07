import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';

import {
  invalidNicknameChar,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  nicknameError,
  normalizeNickname,
} from '../../../utils/nickname';

/**
 * Il campo nickname col suo messaggio d'errore, comune al cambio dal Profilo
 * (EditNicknameModal) e alla scelta dopo la registrazione (WelcomePage). Le
 * regole sono in utils/nickname.ts (copia di quelle del backend, che fanno
 * fede); "gia' in uso" lo sa solo il backend (409 NICKNAME_TAKEN).
 *
 * Va creato in un inizializzatore di campo del componente: usa inject().
 */
export class NicknameField {
  private translate = inject(TranslateService);

  readonly min = NICKNAME_MIN_LENGTH;
  readonly max = NICKNAME_MAX_LENGTH;

  // Un FormControl e non [class.ion-invalid] a mano: Ionic mostra errorText
  // solo con ion-invalid + ion-touched sull'ion-input, e le copia lui dalle
  // classi ng-* del controllo. Messe con un binding Angular sparivano (provato:
  // errorText impostato, classi assenti, messaggio mai mostrato).
  readonly control = new FormControl('', {
    nonNullable: true,
    validators: (c) => {
      const error = nicknameError(normalizeNickname(c.value ?? ''));
      return error ? { nickname: error } : null;
    },
  });
  errorText = '';
  // Il campo e' gia' stato lasciato almeno una volta (o si e' provato a salvare).
  private blurred = false;

  constructor() {
    this.control.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => this.refreshError());
  }

  get value(): string {
    return normalizeNickname(this.control.value);
  }

  onBlur() {
    this.blurred = true;
    this.refreshError();
  }

  /** Errore del backend: resta finche' non si modifica il testo (il validator rigira e lo toglie). */
  setServerError(code: unknown) {
    this.control.setErrors({
      server: typeof code === 'string' && code.startsWith('NICKNAME_') ? code : 'SAVE_ERROR',
    });
    this.refreshError();
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
    const char = invalidNicknameChar(this.value);
    this.errorText = this.translate.instant(`profile.nickname-error.${code}`, {
      min: this.min,
      max: this.max,
      count: this.value.length,
      char: char === ' ' ? this.translate.instant('profile.nickname-space') : char,
    });
  }
}
