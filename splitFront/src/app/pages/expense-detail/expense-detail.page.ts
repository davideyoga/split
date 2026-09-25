import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonChip,
  IonContent,
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

import { CATEGORY_ICONS } from '../../models/category.model';
import { AuthService } from '../../services/auth.service';
import { ExpenseListItem, ExpenseService } from '../../services/expense.service';
import { AmountPipe } from '../../pipes/amount.pipe';

// Dettaglio di una spesa, in sola lettura. Stessa pagina su due rotte, cosi'
// resta nella tab da cui e' stata aperta:
//   /tabs/activity/expense/:id            -> back verso Attivita'
//   /tabs/groups/:publicId/expense/:id    -> back verso il gruppo
// Modifica/eliminazione richiedono endpoint che il backend non ha ancora
// (vedi TODO.md, "Modificare ed eliminare le spese").
@Component({
  selector: 'app-expense-detail',
  templateUrl: './expense-detail.page.html',
  standalone: true,
  imports: [
    AmountPipe,
    CommonModule,
    TranslatePipe,
    IonBackButton,
    IonButtons,
    IonChip,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonNote,
    IonTitle,
    IonToolbar,
  ],
})
export class ExpenseDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private expenseService = inject(ExpenseService);
  private authService = inject(AuthService);

  expense: ExpenseListItem | null = null;
  loadError = false;
  notFound = false;

  groupPublicId = '';
  backHref = '/tabs/activity';
  mePublicId = this.authService.currentUser()?.publicId ?? '';

  constructor() {
    // Le icone delle categorie arrivano dal DB: vanno registrate tutte.
    addIcons({ ...CATEGORY_ICONS });
  }

  ngOnInit() {
    const params = this.route.snapshot.paramMap;
    const id = Number(params.get('id'));
    this.groupPublicId = params.get('publicId') ?? '';
    if (this.groupPublicId) {
      this.backHref = `/tabs/groups/${this.groupPublicId}`;
    }
    this.loadExpense(id);
  }

  // TODO: sostituire con GET /api/expense/:id quando esiste; oggi si ricarica
  // l'intera lista (dell'utente o del gruppo) e si cerca la spesa per id.
  private loadExpense(id: number) {
    const source$ = this.groupPublicId
      ? this.expenseService.listByGroup(this.groupPublicId)
      : this.expenseService.list();

    source$.subscribe({
      next: (expenses) => {
        this.expense = expenses.find((e) => e.id === id) ?? null;
        this.notFound = !this.expense;
      },
      error: () => (this.loadError = true),
    });
  }
}
