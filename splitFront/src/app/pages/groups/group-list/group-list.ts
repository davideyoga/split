import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { close, people, personAddOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';

import { SelectParticipantComponent } from '../../../components/select-participant/select-participant.component';
import { Group } from '../../../models/group.model';
import { User } from '../../../models/user.model';
import { GroupService } from '../../../services/group.service';
import { ParticipantSelectionService } from '../../../services/participant-selection-service';

@Component({
  selector: 'app-group-list',
  templateUrl: './group-list.html',
  styleUrls: ['./group-list.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonChip,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonNote,
    IonText,
    IonTitle,
    IonToolbar,
  ],
})
export class GroupList implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private modalCtrl = inject(ModalController);
  private groupService = inject(GroupService);
  private participantSelectionService = inject(ParticipantSelectionService);

  groups: Group[] = [];
  loadError = false;

  // Membri scelti per il nuovo gruppo (oltre al creatore, aggiunto lato server).
  selectedMembers: User[] = [];
  errorMessage = '';

  groupForm = this.fb.group({
    name: ['', Validators.required],
  });

  private participantSubscription!: Subscription;

  constructor() {
    addIcons({ close, people, 'person-add-outline': personAddOutline });
  }

  ngOnInit() {
    this.loadGroups();

    this.participantSubscription =
      this.participantSelectionService.selectedParticipant$.subscribe(
        (member: User) => {
          if (member && !this.selectedMembers.some((m) => m.publicId === member.publicId)) {
            this.selectedMembers.push(member);
          }
        },
      );
  }

  ngOnDestroy() {
    this.participantSubscription?.unsubscribe();
  }

  loadGroups() {
    this.loadError = false;
    this.groupService.getMyGroups().subscribe({
      next: (groups) => (this.groups = groups),
      error: () => (this.loadError = true),
    });
  }

  async openMemberModal() {
    const modal = await this.modalCtrl.create({
      component: SelectParticipantComponent,
    });
    await modal.present();
  }

  removeMember(member: User) {
    this.selectedMembers = this.selectedMembers.filter(
      (m) => m.publicId !== member.publicId,
    );
  }

  createGroup() {
    if (this.groupForm.invalid) {
      return;
    }

    this.errorMessage = '';

    this.groupService
      .createGroup(
        this.groupForm.value.name as string,
        this.selectedMembers.map((m) => m.publicId),
      )
      .subscribe({
        next: () => {
          this.groupForm.reset();
          this.selectedMembers = [];
          this.loadGroups();
        },
        error: () => {
          this.errorMessage = 'groups.create-error';
        },
      });
  }
}
