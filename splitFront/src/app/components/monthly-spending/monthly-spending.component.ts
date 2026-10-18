import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonCard, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { chevronForward } from 'ionicons/icons';

import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { MoneyPipe } from '../../pipes/money.pipe';
import { SpendingSettingsService } from '../../services/spending-settings.service';
import { formatDay, monthName } from '../../utils/date';
import {
  categoryColor,
  COLORED_CATEGORIES,
  computeMonthlySpending,
  OTHERS_COLOR,
  SpendingExpenseInput,
  spendingPeriod,
} from '../../utils/spending';

interface BarSegment {
  key: string;
  color: string;
  percent: number;
}

// Riquadro "Speso a ottobre" in cima ad Attivita', gemello di quello del saldo
// (stile `.summary-tile` in styles.scss): la somma delle quote dell'utente
// loggato sulle spese del periodo in corso, quanto ha pagato di tasca propria e
// una barra delle categorie con gli stessi colori della pagina Spese. Il periodo
// parte dal giorno scelto nella pagina Spese (default il 1°). Presentazionale
// come `app-expense-balances`: riceve le spese gia' caricate, nessuna chiamata
// HTTP. Toccandolo si apre la pagina Spese (dettaglio per categoria).
@Component({
  selector: 'app-monthly-spending',
  templateUrl: './monthly-spending.component.html',
  styleUrls: ['./monthly-spending.component.scss'],
  standalone: true,
  imports: [RouterLink, TranslatePipe, IonCard, IonIcon, MoneyPipe],
})
export class MonthlySpendingComponent {
  readonly expenses = input.required<readonly SpendingExpenseInput[]>();

  // Valuta mostrata accanto agli importi: per ora sempre EUR (vedi V2.0).
  readonly currency = input('EUR');

  private authService = inject(AuthService);
  private settings = inject(SpendingSettingsService);
  private language = inject(LanguageService);

  readonly startDay = this.settings.monthStartDay;

  // Il periodo si calcola insieme alle spese, che arrivano a ogni ingresso in
  // Attivita': cosi' "oggi" si aggiorna anche se l'app resta aperta a cavallo
  // di due periodi.
  readonly view = computed(() => {
    const period = spendingPeriod(this.settings.monthStartDay());
    const spending = computeMonthlySpending(
      this.expenses(),
      this.authService.currentUser()?.publicId,
      period,
    );
    return {
      spending,
      since: formatDay(period.start, false),
      month: monthName(period.start, this.language.current()),
      bar: barSegments(spending.byCategory.map((row) => row.percent)),
    };
  });

  constructor() {
    addIcons({ 'chevron-forward': chevronForward });
  }
}

// Le categorie colorate come nella ciambella della pagina Spese, le altre in un
// solo segmento grigio. Le percentuali arrivano gia' ordinate e sommano a 100;
// quelle a 0 (meno dell'1%) non si vedrebbero e si saltano.
function barSegments(percents: number[]): BarSegment[] {
  const segments = percents
    .slice(0, COLORED_CATEGORIES)
    .map((percent, i) => ({ key: String(i), color: categoryColor(i), percent }));
  const others = percents.slice(COLORED_CATEGORIES).reduce((sum, percent) => sum + percent, 0);
  segments.push({ key: 'others', color: OTHERS_COLOR, percent: others });
  return segments.filter((segment) => segment.percent > 0);
}
