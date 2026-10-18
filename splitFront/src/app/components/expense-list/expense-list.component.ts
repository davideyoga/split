import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon, IonItem, IonLabel, IonList, IonText } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { receiptOutline } from 'ionicons/icons';

import { CATEGORY_ICONS, isSmartSplit } from '../../models/category.model';
import { AuthService } from '../../services/auth.service';
import { ExpenseListItem } from '../../services/expense.service';
import { LanguageService } from '../../services/language.service';
import { MoneyPipe } from '../../pipes/money.pipe';
import { toCents } from '../../utils/balance';
import { addDays, dayOf, longDay, todayIso } from '../../utils/date';

// Cosa dice la riga accanto a chi ha pagato: il gruppo, o con chi e' divisa
// (gli altri contributori, senza me e senza chi ha pagato, gia' nominato).
type RowContext = { kind: 'group'; name: string } | { kind: 'with'; names: string[] };

interface ExpenseRow {
  expense: ExpenseListItem;
  link: string[];
  icon: string;
  // Spesa solo mia: unico contributore, l'ho pagata io.
  solo: boolean;
  payerIsMe: boolean;
  amountCents: number;
  // Cifra in grande: la mia quota con `showMyShare` (se ne ho una), altrimenti
  // l'importo intero. Con la quota in grande, l'importo intero va nel
  // sottotitolo ("Hai pagato 84,50 €").
  showsShare: boolean;
  mainCents: number;
  context: RowContext | null;
  // Cosa cambia nei conti con gli altri: quanto ho anticipato per loro, o
  // quanto devo a chi ha pagato. Solo con `showMyShare`.
  effect: { kind: 'lent' | 'owe'; cents: number } | null;
}

interface DayGroup {
  day: string;
  kind: 'today' | 'yesterday' | 'other';
  // Giorno per esteso, per 'other' ("Venerdì 16 ottobre").
  label: string;
  rows: ExpenseRow[];
}

// Lista di spese gia' caricate, raggruppate per giorno (Oggi, Ieri, poi la
// data): icona della categoria, descrizione, chi ha pagato e con chi, importo;
// ogni riga apre il dettaglio della spesa. Presentazionale come
// app-expense-balances: niente chiamate HTTP, empty state e titolo li decide la
// pagina che la usa (Attivita', gruppo, spese di una categoria). Le spese
// devono arrivare dalla piu' recente, come le manda l'API.
@Component({
  selector: 'app-expense-list',
  templateUrl: './expense-list.component.html',
  styleUrls: ['./expense-list.component.scss'],
  standalone: true,
  imports: [IonIcon, IonItem, IonLabel, IonList, IonText, MoneyPipe, RouterLink, TranslatePipe],
})
export class ExpenseListComponent {
  private authService = inject(AuthService);
  private language = inject(LanguageService);

  readonly expenses = input.required<readonly ExpenseListItem[]>();
  // Rotta del dettaglio senza il publicId della spesa, che si aggiunge in
  // fondo: il dettaglio deve aprirsi nella tab da cui si arriva
  // (es. ['/tabs/activity/expense'] o ['/tabs/groups', id, 'expense']).
  readonly detailPath = input.required<readonly string[]>();
  // In grande la quota dell'utente loggato invece dell'importo intero, con
  // sotto quanto ha prestato o deve: dove conta quello che resta a suo carico
  // (Attivita', spese di una categoria), che e' anche il numero dello speso
  // del mese. Il gruppo mostra invece gli importi interi.
  readonly showMyShare = input(false);
  // Il nome del gruppo accanto a chi ha pagato; spento nella lista di un
  // gruppo, dove sarebbe sempre lo stesso.
  readonly showGroup = input(true);

  readonly days = computed<DayGroup[]>(() => {
    const me = this.authService.currentUser()?.publicId;
    const lang = this.language.current();
    const today = todayIso();
    const yesterday = addDays(today, -1);

    const groups: DayGroup[] = [];
    for (const expense of this.expenses()) {
      const day = dayOf(expense.date);
      let group = groups[groups.length - 1];
      if (!group || group.day !== day) {
        group = {
          day,
          kind: day === today ? 'today' : day === yesterday ? 'yesterday' : 'other',
          label: longDay(day, lang, day.slice(0, 4) !== today.slice(0, 4)),
          rows: [],
        };
        groups.push(group);
      }
      group.rows.push(this.toRow(expense, me));
    }
    return groups;
  });

  // Titolo tradotto delle spese della divisione intelligente (senza descrizione).
  isSmartSplit = isSmartSplit;

  constructor() {
    // Le icone delle categorie arrivano dal DB: vanno registrate tutte.
    addIcons({ ...CATEGORY_ICONS, 'receipt-outline': receiptOutline });
  }

  private toRow(expense: ExpenseListItem, me: string | undefined): ExpenseRow {
    const contributions = expense.expenseContributions;
    const mine = contributions.find((c) => c.user.publicId === me);
    const payerIsMe = expense.paidBy.publicId === me;
    const solo = payerIsMe && contributions.every((c) => c.user.publicId === me);
    const amountCents = toCents(expense.amount);
    const shareCents = mine ? toCents(mine.share) : null;
    const showShare = this.showMyShare() && shareCents !== null;

    // Come nei saldi: quello che ho anticipato e' la somma delle quote degli
    // altri, non importo meno la mia quota (vedi utils/balance.ts).
    let effect: ExpenseRow['effect'] = null;
    if (showShare && !solo) {
      const cents = payerIsMe
        ? contributions
            .filter((c) => c.user.publicId !== me)
            .reduce((sum, c) => sum + toCents(c.share), 0)
        : (shareCents ?? 0);
      if (cents > 0) {
        effect = { kind: payerIsMe ? 'lent' : 'owe', cents };
      }
    }

    let context: RowContext | null = null;
    if (expense.group) {
      context = this.showGroup() ? { kind: 'group', name: expense.group.name } : null;
    } else if (!solo) {
      const names = contributions
        .filter((c) => c.user.publicId !== me && c.user.publicId !== expense.paidBy.publicId)
        .map((c) => c.user.nickName);
      context = names.length > 0 ? { kind: 'with', names } : null;
    }

    return {
      expense,
      link: [...this.detailPath(), expense.publicId],
      icon: expense.category?.icon ?? 'receipt-outline',
      solo,
      payerIsMe,
      amountCents,
      showsShare: showShare,
      mainCents: showShare ? (shareCents ?? 0) : amountCents,
      context,
      effect,
    };
  }
}
