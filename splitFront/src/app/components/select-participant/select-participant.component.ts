import { Component, inject, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Group } from '../../models/group.model';
import { User } from '../../models/user.model';
import { GroupService } from '../../services/group.service';
import { UserService } from '../../services/user.service';

type SelectMode = 'person' | 'group';

// Risultato restituito con `dismiss(data, 'selected')`: il chiamante lo legge
// da `modal.onWillDismiss()`. Passare il dato col dismiss (invece che da un
// servizio globale) evita che altre pagine ancora montate sotto la modale
// reagiscano a una scelta che non era per loro.
export interface ParticipantSelection {
  user?: User;
  group?: Group;
}

@Component({
  selector: 'app-select-participant',
  templateUrl: './select-participant.component.html',
  styleUrls: ['./select-participant.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonNote,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
})
export class SelectParticipantComponent implements OnInit {
  // false = solo persone (es. aggiunta membri a un gruppo): il segmento
  // "Gruppo" non viene mostrato.
  @Input() allowGroups = true;

  private userService = inject(UserService);
  private groupService = inject(GroupService);
  private modalCtrl = inject(ModalController);

  mode: SelectMode = 'person';

  // Chi condivide gia' con me una spesa o un gruppo; gli altri si trovano con
  // la ricerca esatta.
  contacts: User[] = [];
  searchResults: User[] = [];
  searchQuery = '';
  isLoading = false;
  // Testo a cui si riferiscono searchResults/searchFailed: "nessun utente" si
  // mostra solo dopo aver premuto Cerca, e sparisce appena si cambia il testo.
  private searchedQuery: string | null = null;
  searchFailed = false;
  searchErrorKey = 'select-participant.search-error';

  groups: Group[] = [];
  groupsLoading = false;
  private groupsLoaded = false;

  ngOnInit() {
    // Senza contatti (o se la chiamata fallisce) resta la sola ricerca esatta.
    this.userService.getContacts().subscribe({
      next: (contacts) => (this.contacts = contacts),
      error: () => undefined,
    });
  }

  // I contatti il cui nickname contiene il testo scritto (tutti, se e' vuoto),
  // tranne chi e' gia' nel risultato della ricerca qui sopra.
  get filteredContacts(): User[] {
    const q = this.searchQuery.trim().toLowerCase();
    const shown = this.hasSearched ? this.searchResults : [];
    return this.contacts.filter(
      (c) =>
        (!q || c.nickName.toLowerCase().includes(q)) &&
        !shown.some((user) => user.publicId === c.publicId),
    );
  }

  onModeChange(event: Event) {
    const value = (event as CustomEvent<{ value?: SelectMode }>).detail.value;
    this.mode = value ?? 'person';

    if (this.mode === 'group' && !this.groupsLoaded) {
      this.groupsLoading = true;
      this.groupService.getMyGroups().subscribe((groups) => {
        this.groups = groups;
        this.groupsLoading = false;
        this.groupsLoaded = true;
      });
    }
  }

  // Ricerca esatta per nickname o email, solo col bottone Cerca (o Invio):
  // niente ricerca mentre si scrive, che con un match esatto darebbe
  // "nessun utente" a ogni lettera.
  searchUsers() {
    const query = this.searchQuery.trim();
    if (!query || this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.searchResults = [];
    this.searchFailed = false;
    this.userService.getUsers(query).subscribe({
      next: (users) => {
        this.searchResults = users;
        this.searchedQuery = query;
        this.isLoading = false;
      },
      error: (error: { status?: number }) => {
        this.searchErrorKey =
          error.status === 429 ? 'select-participant.rate-limited' : 'select-participant.search-error';
        this.searchFailed = true;
        this.searchedQuery = query;
        this.isLoading = false;
      },
    });
  }

  // true se il risultato mostrato e' quello del testo scritto ora.
  get hasSearched(): boolean {
    return this.searchedQuery !== null && this.searchedQuery === this.searchQuery.trim();
  }

  selectParticipant(selectedParticipant: User) {
    const data: ParticipantSelection = { user: selectedParticipant };
    this.modalCtrl.dismiss(data, 'selected');
  }

  selectGroup(group: Group) {
    const data: ParticipantSelection = { group };
    this.modalCtrl.dismiss(data, 'selected');
  }

  dismissModal() {
    this.modalCtrl.dismiss();
  }
}
