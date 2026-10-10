import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonChip, IonIcon, IonItem, IonLabel, IonList, IonNote } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import { CATEGORY_ICONS, isSmartSplit } from '../../models/category.model';
import { AmountPipe } from '../../pipes/amount.pipe';
import { ExpenseListItem } from '../../services/expense.service';

interface ExpenseRow {
  expense: ExpenseListItem;
  link: string[];
  // Quota di `shareOf`, null se non richiesta o se non ne ha una.
  share: string | null;
}

// Lista di spese gia' caricate: descrizione, chi ha pagato, categoria, importo
// e data; ogni riga apre il dettaglio della spesa. Presentazionale come
// app-expense-balances: niente chiamate HTTP, empty state e titolo li decide
// la pagina che la usa (Attivita', gruppo, spese di una categoria).
@Component({
  selector: 'app-expense-list',
  templateUrl: './expense-list.component.html',
  styleUrls: ['./expense-list.component.scss'],
  standalone: true,
  imports: [
    AmountPipe,
    DatePipe,
    IonChip,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    RouterLink,
    TranslatePipe,
  ],
})
export class ExpenseListComponent {
  readonly expenses = input.required<readonly ExpenseListItem[]>();
  // Rotta del dettaglio senza il publicId della spesa, che si aggiunge in
  // fondo: il dettaglio deve aprirsi nella tab da cui si arriva
  // (es. ['/tabs/activity/expense'] o ['/tabs/groups', id, 'expense']).
  readonly detailPath = input.required<readonly string[]>();
  // publicId di un utente di cui mostrare la quota in ogni riga (la pagina
  // Spese per categoria, dove conta la mia quota e non l'importo intero).
  readonly shareOf = input<string | null | undefined>(null);

  readonly rows = computed<ExpenseRow[]>(() => {
    const shareOf = this.shareOf();
    return this.expenses().map((expense) => ({
      expense,
      link: [...this.detailPath(), expense.publicId],
      share: shareOf
        ? (expense.expenseContributions.find((c) => c.user.publicId === shareOf)?.share ?? null)
        : null,
    }));
  });

  // Titolo tradotto delle spese della divisione intelligente (senza descrizione).
  isSmartSplit = isSmartSplit;

  constructor() {
    // Le icone delle categorie arrivano dal DB: vanno registrate tutte.
    addIcons({ ...CATEGORY_ICONS });
  }
}
