import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonItem, IonList, IonButton, IonInput, IonText, NavController } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../services/auth.service';

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
  private route = inject(ActivatedRoute);
  private navCtrl = inject(NavController);

  errorMessage = '';

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  submit() {
    if (this.loginForm.invalid) {
      return;
    }

    const email = this.loginForm.value.email;
    if (!email) {
      return;
    }

    this.errorMessage = '';

    this.authService.login(email).subscribe({
      // navigateRoot: la shell riparte da zero, senza pagine della sessione
      // precedente nello stack.
      next: () => this.navCtrl.navigateRoot(this.returnUrl()),
      error: () => {
        this.errorMessage = 'login.user-not-found';
      }
    });
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
