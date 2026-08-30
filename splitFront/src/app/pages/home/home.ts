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
  IonListHeader,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { addIcons } from 'ionicons';
import { add, logOutOutline, people } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { ExpenseListItem, ExpenseService } from '../../services/expense.service';
import { Group } from '../../models/group.model';
import { GroupService } from '../../services/group.service';

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
    IonListHeader,
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
  private groupService = inject(GroupService);
  private router = inject(Router);

  expenses: ExpenseListItem[] = [];
  groups: Group[] = [];
  loadError = false;

  constructor() {
    addIcons({ add, 'log-out-outline': logOutOutline, people });
  }

  ngOnInit() {
    this.loadExpenses();
    this.loadGroups();
  }

  loadGroups() {
    this.groupService.getMyGroups().subscribe({
      next: (groups) => (this.groups = groups),
      error: () => (this.groups = []),
    });
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
