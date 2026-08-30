import { RouterLink, Router } from '@angular/router';
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonButtons,
  IonButton,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { addIcons } from 'ionicons';
import { add, logOutOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { ExpenseListItem, ExpenseService } from '../../services/expense.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonButtons,
    IonButton,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonTitle,
    IonToolbar,
    RouterLink,
    TranslatePipe,
  ],
})
export class Home implements OnInit {
  private authService = inject(AuthService);
  private expenseService = inject(ExpenseService);
  private router = inject(Router);

  expenses: ExpenseListItem[] = [];
  loadError = false;

  constructor() {
    addIcons({ add, 'log-out-outline': logOutOutline });
  }

  ngOnInit() {
    this.loadExpenses();
  }

  loadExpenses() {
    this.loadError = false;
    this.expenseService.list().subscribe({
      next: (expenses) => (this.expenses = expenses),
      error: () => (this.loadError = true),
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
