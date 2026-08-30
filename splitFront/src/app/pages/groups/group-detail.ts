import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { personAddOutline, trashOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';

import { SelectParticipantComponent } from '../../components/select-participant/select-participant.component';
import { Group } from '../../models/group.model';
import { User } from '../../models/user.model';
import { GroupService } from '../../services/group.service';
import { ParticipantSelectionService } from '../../services/participant-selection-service';

@Component({
  selector: 'app-group-detail',
  templateUrl: './group-detail.html',
  styleUrls: ['./group-detail.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonText,
    IonTitle,
    IonToolbar,
  ],
})
export class GroupDetail implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);
  private groupService = inject(GroupService);
  private participantSelectionService = inject(ParticipantSelectionService);

  group: Group | null = null;
  loadError = false;
  errorMessage = '';

  nameForm = this.fb.group({
    name: ['', Validators.required],
  });

  private publicId = '';
  private participantSubscription!: Subscription;

  constructor() {
    addIcons({
      'person-add-outline': personAddOutline,
      'trash-outline': trashOutline,
    });
  }

  ngOnInit() {
    this.publicId = this.route.snapshot.paramMap.get('publicId') ?? '';
    this.loadGroup();

    this.participantSubscription =
      this.participantSelectionService.selectedParticipant$.subscribe(
        (member: User) => {
          if (member) {
            this.addMember(member);
          }
        },
      );
  }

  ngOnDestroy() {
    this.participantSubscription?.unsubscribe();
  }

  loadGroup() {
    this.loadError = false;
    this.groupService.getGroup(this.publicId).subscribe({
      next: (group) => {
        this.group = group;
        this.nameForm.patchValue({ name: group.name });
      },
      error: () => (this.loadError = true),
    });
  }

  rename() {
    if (this.nameForm.invalid || !this.group) {
      return;
    }
    this.errorMessage = '';
    this.groupService
      .renameGroup(this.publicId, this.nameForm.value.name as string)
      .subscribe({
        next: (group) => {
          this.group = group;
          this.presentToast('groups.rename-success');
        },
        error: () => (this.errorMessage = 'groups.rename-error'),
      });
  }

  private async presentToast(
    messageKey: string,
    color: 'success' | 'danger' = 'success',
  ) {
    const toast = await this.toastCtrl.create({
      message: this.translate.instant(messageKey),
      duration: 2000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }

  async openMemberModal() {
    const modal = await this.modalCtrl.create({
      component: SelectParticipantComponent,
    });
    await modal.present();
  }

  addMember(member: User) {
    if (this.group?.members.some((m) => m.publicId === member.publicId)) {
      return;
    }
    this.errorMessage = '';
    this.groupService.addMembers(this.publicId, [member.publicId]).subscribe({
      next: (group) => (this.group = group),
      error: () => (this.errorMessage = 'groups.member-error'),
    });
  }

  removeMember(member: User) {
    this.errorMessage = '';
    this.groupService.removeMember(this.publicId, member.publicId).subscribe({
      next: () => this.loadGroup(),
      error: () => (this.errorMessage = 'groups.member-error'),
    });
  }
}
