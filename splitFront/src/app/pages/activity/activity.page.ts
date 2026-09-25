import { RouterLink, Router } from '@angular/router';
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonButtons,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
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
import { ExpenseBalancesComponent } from '../../components/expense-balances/expense-balances.component';
import { AuthService } from '../../services/auth.service';
import { ExpenseListItem, ExpenseService } from '../../services/expense.service';
import { CATEGORY_ICONS } from '../../models/category.model';
import { Group } from '../../models/group.model';
import { GroupService } from '../../services/group.service';

// Ex `home`: spostata dentro la shell a tab senza redesign. Il redesign
// (rimozione della card Gruppi e delle icone nell'header, item spesa tappabili,
// ion-refresher, empty state con CTA) e' previsto nelle fasi successive.
@Component({
  selector: 'app-activity',
  templateUrl: './activity.page.html',
  styleUrls: ['./activity.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ExpenseBalancesComponent,
    IonButtons,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonChip,
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
export class ActivityPage implements OnInit {
  private authService = inject(AuthService);
  private expenseService = inject(ExpenseService);
  private groupService = inject(GroupService);
  private router = inject(Router);

  expenses: ExpenseListItem[] = [];
  groups: Group[] = [];
  loadError = false;

  constructor() {
    // Le icone delle categorie arrivano dal DB: vanno registrate tutte.
    addIcons({ add, 'log-out-outline': logOutOutline, people, ...CATEGORY_ICONS });
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
