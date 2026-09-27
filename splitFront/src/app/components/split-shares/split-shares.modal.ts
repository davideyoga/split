import { Component, inject, Input, OnInit } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonProgressBar,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { pieChartOutline } from 'ionicons/icons';

import { User } from '../../models/user.model';
import { formatCents, toCents } from '../../utils/balance';
import { splitEqually } from '../../utils/split';

// Quote personalizzate, in centesimi, per publicId dell'utente.
export type ShareMap = Record<string, number>;

// Divisione diseguale di una spesa, aperta dalla riga "Divisione" di
// ExpenseFormModal. Un campo per persona e, fisso in alto, il riepilogo
// totale / assegnato / mancante: "Fatto" si abilita solo quando le quote fanno
// esattamente il totale.
// Chiude con `dismiss(quote, 'confirmed')`, dove `quote` e' uno ShareMap oppure
// `null` se si e' tornati alla divisione equa ("Dividi in parti uguali" e poi
// nessuna modifica); `dismiss(null, 'cancel')` se si annulla.
@Component({
  selector: 'app-split-shares',
  templateUrl: './split-shares.modal.html',
  styleUrls: ['./split-shares.modal.scss'],
  standalone: true,
  imports: [
    TranslatePipe,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonProgressBar,
    IonText,
    IonTitle,
    IonToolbar,
  ],
})
export class SplitSharesModal implements OnInit {
  // Importo della spesa, in centesimi.
  @Input() totalCents = 0;
  // Contributori, nello stesso ordine del backend (creatore, partecipanti,
  // membri del gruppo): conta per chi riceve i centesimi di resto.
  @Input() people: User[] = [];
  // Quote attuali; null = divisione equa.
  @Input() shares: ShareMap | null = null;
  @Input() paidByPublicId = '';
  @Input() mePublicId = '';

  private modalCtrl = inject(ModalController);

  // Testo di ogni campo, per publicId. Vuoto = 0.
  values: Record<string, string> = {};
  // True finche' le quote sono quelle della divisione equa.
  equal = true;

  constructor() {
    addIcons({ 'pie-chart-outline': pieChartOutline });
  }

  ngOnInit() {
    if (this.shares) {
      this.equal = false;
      for (const person of this.people) {
        const cents = this.shares[person.publicId] ?? 0;
        this.values[person.publicId] = cents ? formatCents(cents) : '';
      }
    } else {
      this.fillEqually();
    }
  }

  get assignedCents(): number {
    return this.people.reduce(
      (sum, person) => sum + toCents(this.values[person.publicId]),
      0,
    );
  }

  // > 0 manca ancora qualcosa, < 0 si e' assegnato troppo.
  get remainingCents(): number {
    return this.totalCents - this.assignedCents;
  }

  get progress(): number {
    return this.totalCents > 0
      ? Math.min(this.assignedCents / this.totalCents, 1)
      : 0;
  }

  // Valore assoluto a 2 decimali: il segno lo danno etichetta e colore.
  format(cents: number): string {
    return formatCents(cents);
  }

  fillEqually() {
    const cents = splitEqually(this.totalCents, this.people.length);
    this.people.forEach((person, i) => {
      this.values[person.publicId] = formatCents(cents[i]);
    });
    this.equal = true;
  }

  // Scorciatoia "io 15, il resto a Pippo": aggiunge quel che manca a una persona.
  assignRemaining(person: User) {
    const remaining = this.remainingCents;
    if (remaining <= 0) {
      return;
    }
    this.values[person.publicId] = formatCents(
      toCents(this.values[person.publicId]) + remaining,
    );
    this.equal = false;
  }

  // Solo cifre e un separatore decimale (virgola o punto), massimo 2 decimali.
  onInput(person: User, event: Event) {
    const input = event.target as HTMLIonInputElement;
    const detail = (event as CustomEvent<{ value?: string | null }>).detail;
    let value = (detail.value ?? '').replace(',', '.').replace(/[^0-9.]/g, '');

    const firstDot = value.indexOf('.');
    if (firstDot !== -1) {
      value =
        value.slice(0, firstDot + 1) +
        value.slice(firstDot + 1).replace(/\./g, '').slice(0, 2);
    }

    input.value = value;
    this.values[person.publicId] = value;
    this.equal = false;
  }

  // Uscendo dal campo l'importo si normalizza a 2 decimali ("15" -> "15.00").
  onBlur(person: User) {
    const value = this.values[person.publicId];
    if (value) {
      this.values[person.publicId] = formatCents(toCents(value));
    }
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    if (this.remainingCents !== 0) {
      return;
    }
    const shares: ShareMap = {};
    for (const person of this.people) {
      shares[person.publicId] = toCents(this.values[person.publicId]);
    }
    this.modalCtrl.dismiss(this.equal ? null : shares, 'confirmed');
  }
}
