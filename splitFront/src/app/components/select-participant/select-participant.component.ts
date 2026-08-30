import { Component, inject } from '@angular/core';
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
import { ParticipantSelectionService } from '../../services/participant-selection-service';
import { UserService } from '../../services/user.service';

type SelectMode = 'person' | 'group';

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
  private userService = inject(UserService);
  private groupService = inject(GroupService);
  private modalCtrl = inject(ModalController);
  private participantSelectionService = inject(ParticipantSelectionService);

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
    this.participantSelectionService.selectParticipant(selectedParticipant);
    this.modalCtrl.dismiss();
  }

  selectGroup(group: Group) {
    this.participantSelectionService.selectGroup(group);
    this.modalCtrl.dismiss();
  }

  dismissModal() {
    this.modalCtrl.dismiss();
  }
}
