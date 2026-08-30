import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonItem, IonList, IonButton, IonInput, IonText } from '@ionic/angular/standalone';
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
  private router = inject(Router);

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
      next: () => this.router.navigateByUrl('/home'),
      error: () => {
        this.errorMessage = 'login.user-not-found';
      }
    });
  }
}
