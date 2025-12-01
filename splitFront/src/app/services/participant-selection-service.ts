// src/app/services/data-sharing.service.ts

import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class ParticipantSelectionService {

  // Usiamo un Subject per emettere il nuovo partecipante selezionato
  private selectedParticipantSource = new Subject<User>();

  // La pagina si iscriverà a questo Observable per ricevere i dati
  selectedParticipant$ = this.selectedParticipantSource.asObservable();

  // La modale chiamerà questo metodo quando un utente viene selezionato
  selectParticipant(participant: User) {
    this.selectedParticipantSource.next(participant);
  }
}