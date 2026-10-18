import { Component, computed, input } from '@angular/core';
import { IonCard, IonItem, IonLabel, IonList, IonSkeletonText } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

// Larghezze (in %) di titolo e sottotitolo delle righe finte, a rotazione:
// righe tutte uguali sembrerebbero una griglia, non una lista.
const LINE_WIDTHS: readonly [number, number][] = [
  [62, 44],
  [48, 70],
  [70, 38],
  [55, 60],
  [40, 52],
];

// Segnaposto mostrato mentre una pagina aspetta i suoi dati la prima volta:
// la forma delle righe di Split (cerchio a sinistra, titolo e sottotitolo,
// cifra a destra) e, a richiesta, i due riquadri gemelli in cima. Si mostra
// solo finche' non e' arrivato nulla: ai ricaricamenti successivi (rientro
// nella tab, pull-to-refresh) resta la lista vecchia, che non lampeggia.
// Per gli screen reader e' un solo "Caricamento…" (role="status"), il resto e'
// aria-hidden.
@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  imports: [IonCard, IonItem, IonLabel, IonList, IonSkeletonText, TranslatePipe],
  templateUrl: './loading-skeleton.component.html',
  styleUrls: ['./loading-skeleton.component.scss'],
})
export class LoadingSkeletonComponent {
  // Quante righe finte.
  readonly rows = input(5);
  // I due riquadri riepilogo in cima (Attivita', Saldi).
  readonly tiles = input(false);
  // L'intestazione della lista (il giorno, "I tuoi gruppi"…).
  readonly header = input(true);
  // La cifra a destra (no per i gruppi, che hanno solo la freccia).
  readonly amounts = input(true);

  readonly lines = computed(() =>
    Array.from({ length: this.rows() }, (_, i) => LINE_WIDTHS[i % LINE_WIDTHS.length]),
  );
}
