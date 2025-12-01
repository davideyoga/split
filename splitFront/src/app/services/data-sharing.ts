// File: src/app/services/data-sharing.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root', // Questo lo rende disponibile a tutta l'app
})
export class DataSharingService {
  // Usiamo un BehaviorSubject per "memorizzare" l'ultimo valore emesso
  // e notificarlo ai nuovi iscritti.
  private selectedParticipantSource = new BehaviorSubject<string | null>(null);

  // Creiamo un Observable pubblico che i componenti possono "ascoltare"
  public selectedParticipant$ = this.selectedParticipantSource.asObservable();

  constructor() {}

  // Metodo per aggiornare il partecipante selezionato
  setSelectedParticipant(email: string) {
    this.selectedParticipantSource.next(email);
  }
}