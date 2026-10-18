import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { chevronBack, chevronForward, helpCircleOutline } from 'ionicons/icons';

import { CATEGORY_ICONS } from '../../models/category.model';
import { AuthService } from '../../services/auth.service';
import { ExpenseListItem, ExpenseService } from '../../services/expense.service';
import { SpendingSettingsService } from '../../services/spending-settings.service';
import { MoneyPipe } from '../../pipes/money.pipe';
import { formatDay } from '../../utils/date';
import {
  categoryColor,
  CategorySpending,
  COLORED_CATEGORIES,
  computeMonthlySpending,
  OTHERS_COLOR,
  shiftPeriod,
  spendingPeriod,
} from '../../utils/spending';

// Geometria della ciambella (unita' del viewBox 0 0 120 120).
// Anello sottile: dentro deve starci il totale anche a 5 cifre.
const RADIUS = 50;
const STROKE_WIDTH = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// Spazio vuoto fra due fette (~2px a 220px di lato), perche' due colori
// vicini non si confondano.
const GAP = 1.1;

export interface SpendingRow extends CategorySpending {
  color: string;
}

export interface DonutSlice {
  key: string;
  // null = la fetta "Altre".
  row: SpendingRow | null;
  color: string;
  percent: number;
  dashArray: string;
  dashOffset: number;
}

// Pagina Spese, aperta toccando "Speso questo mese" in Attivita': il periodo
// (un "mese" che parte dal giorno scelto qui, es. il 25 dello stipendio), con
// le frecce per i periodi precedenti, e le mie quote per categoria in una
// ciambella e in una lista con importo e percentuale. Calcolo tutto lato
// client (utils/spending.ts) sulle spese di GET /api/expense. Toccando una
// categoria si apre la lista delle sue spese (pages/spending-category).
@Component({
  selector: 'app-spending',
  templateUrl: './spending.page.html',
  styleUrls: ['./spending.page.scss'],
  standalone: true,
  imports: [
    MoneyPipe,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToolbar,
    RouterLink,
    TranslatePipe,
  ],
})
export class SpendingPage {
  private authService = inject(AuthService);
  private expenseService = inject(ExpenseService);
  private settings = inject(SpendingSettingsService);

  readonly days = Array.from({ length: 31 }, (_, i) => i + 1);
  readonly radius = RADIUS;
  readonly strokeWidth = STROKE_WIDTH;
  readonly startDay = this.settings.monthStartDay;

  private readonly expenses = signal<ExpenseListItem[]>([]);
  // 0 = periodo in corso, -1 quello prima, e cosi' via.
  readonly offset = signal(0);
  loaded = false;
  loadError = false;

  readonly period = computed(() => {
    const startDay = this.startDay();
    const current = spendingPeriod(startDay);
    return this.offset() === 0 ? current : shiftPeriod(current, this.offset(), startDay);
  });

  readonly periodLabel = computed(
    () => `${formatDay(this.period().start)} – ${formatDay(this.period().end)}`,
  );

  readonly spending = computed(() =>
    computeMonthlySpending(
      this.expenses(),
      this.authService.currentUser()?.publicId,
      this.period(),
    ),
  );

  // Il colore va alla posizione nella classifica del periodo: le categorie
  // possibili sono piu' dei colori distinguibili, quindi una stessa categoria
  // puo' cambiare colore fra due periodi. Nome e icona accanto la identificano.
  readonly rows = computed<SpendingRow[]>(() =>
    this.spending().byCategory.map((row, i) => ({ ...row, color: categoryColor(i) })),
  );

  readonly slices = computed<DonutSlice[]>(() => {
    const rows = this.rows();
    const colored = rows.length > COLORED_CATEGORIES ? rows.slice(0, COLORED_CATEGORIES) : rows;
    const others = rows.slice(colored.length);
    const total = this.spending().shareCents;
    if (total <= 0) {
      return [];
    }

    const parts = colored.map((row) => ({
      key: row.key,
      row: row as SpendingRow | null,
      color: row.color,
      cents: row.shareCents,
      percent: row.percent,
    }));
    if (others.length > 0) {
      parts.push({
        key: 'others',
        row: null,
        color: OTHERS_COLOR,
        cents: others.reduce((sum, row) => sum + row.shareCents, 0),
        percent: others.reduce((sum, row) => sum + row.percent, 0),
      });
    }

    // Ogni fetta e' un arco dello stesso cerchio: stroke-dasharray disegna la
    // sua lunghezza, stroke-dashoffset la sposta dopo le precedenti.
    let start = 0;
    return parts.map((part) => {
      const length = (part.cents / total) * CIRCUMFERENCE;
      const visible = parts.length > 1 ? Math.max(length - GAP, 0) : length;
      const slice: DonutSlice = {
        key: part.key,
        row: part.row,
        color: part.color,
        percent: part.percent,
        dashArray: `${visible} ${CIRCUMFERENCE - visible}`,
        dashOffset: -start,
      };
      start += length;
      return slice;
    });
  });


  constructor() {
    addIcons({
      'chevron-back': chevronBack,
      'chevron-forward': chevronForward,
      'help-circle-outline': helpCircleOutline,
      ...CATEGORY_ICONS,
    });
  }

  ionViewWillEnter() {
    this.load();
  }

  load(onDone?: () => void) {
    this.loadError = false;
    this.expenseService.list().subscribe({
      next: (expenses) => {
        this.expenses.set(expenses);
        this.loaded = true;
        onDone?.();
      },
      error: () => {
        this.loadError = true;
        onDone?.();
      },
    });
  }

  refresh(event: Event) {
    this.load(() => (event.target as HTMLIonRefresherElement).complete());
  }

  shift(delta: number) {
    this.offset.set(Math.min(this.offset() + delta, 0));
  }

  // Cambiare giorno riporta al periodo in corso: quello visualizzato prima
  // era calcolato con l'altro giorno d'inizio.
  setStartDay(event: Event) {
    const value = (event as CustomEvent<{ value: number }>).detail.value;
    this.settings.setMonthStartDay(value);
    this.offset.set(0);
  }
}
