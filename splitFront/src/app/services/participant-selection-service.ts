// src/app/services/participant-selection-service.ts

import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Group } from '../models/group.model';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class ParticipantSelectionService {
  // Un partecipante singolo scelto dalla modale select-participant.
  private selectedParticipantSource = new Subject<User>();
  selectedParticipant$ = this.selectedParticipantSource.asObservable();

  // Un gruppo scelto dalla modale select-participant (segmento "Gruppo").
  private selectedGroupSource = new Subject<Group>();
  selectedGroup$ = this.selectedGroupSource.asObservable();

  selectParticipant(participant: User) {
    this.selectedParticipantSource.next(participant);
  }

  selectGroup(group: Group) {
    this.selectedGroupSource.next(group);
  }
}
