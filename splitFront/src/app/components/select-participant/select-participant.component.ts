import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
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
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
})
export class SelectParticipantComponent {
  // false = solo persone (es. aggiunta membri a un gruppo): il segmento
  // "Gruppo" non viene mostrato.
  @Input() allowGroups = true;

  private userService = inject(UserService);
  private groupService = inject(GroupService);
  private modalCtrl = inject(ModalController);

  mode: SelectMode = 'person';

  searchResults: User[] = [];
  searchQuery = '';
  isLoading = false;

  groups: Group[] = [];
  groupsLoading = false;
  private groupsLoaded = false;

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

  searchUsers() {
    if (this.searchQuery.trim().length < 3) {
      this.searchResults = [];
      return;
    }

    this.isLoading = true;
    this.searchResults = [];
    this.userService.getUsers(this.searchQuery).subscribe((users) => {
      this.searchResults = users;
      this.isLoading = false;
    });
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
