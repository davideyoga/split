import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonChip,
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
import { close, personAddOutline } from 'ionicons/icons';

import {
  ParticipantSelection,
  SelectParticipantComponent,
} from '../../../components/select-participant/select-participant.component';
import { User } from '../../../models/user.model';
import { GroupService } from '../../../services/group.service';

// Nuovo gruppo come modale (aperta dal FAB della lista gruppi), cosi' la lista
// resta il contenuto principale della tab. Chiude con dismiss(null, 'created')
// dopo aver mostrato il toast, o dismiss(null, 'cancel').
@Component({
  selector: 'app-new-group',
  templateUrl: './new-group.modal.html',
  styleUrls: ['./new-group.modal.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    IonButton,
    IonButtons,
    IonChip,
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
export class NewGroupModal {
  private fb = inject(FormBuilder);
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);
  private groupService = inject(GroupService);

  // Membri scelti (oltre al creatore, aggiunto lato server).
  selectedMembers: User[] = [];
  errorMessage = '';
  saving = false;

  groupForm = this.fb.group({
    name: ['', Validators.required],
  });

  constructor() {
    addIcons({ close, 'person-add-outline': personAddOutline });
  }

  async openMemberModal() {
    const modal = await this.modalCtrl.create({
      component: SelectParticipantComponent,
      componentProps: { allowGroups: false },
    });
    await modal.present();

    const { data } = await modal.onWillDismiss<ParticipantSelection>();
    const member = data?.user;
    if (member && !this.selectedMembers.some((m) => m.publicId === member.publicId)) {
      this.selectedMembers = [...this.selectedMembers, member];
    }
  }

  removeMember(member: User) {
    this.selectedMembers = this.selectedMembers.filter(
      (m) => m.publicId !== member.publicId,
    );
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  createGroup() {
    if (this.groupForm.invalid || this.saving) {
      return;
    }

    this.errorMessage = '';
    this.saving = true;

    this.groupService
      .createGroup(
        this.groupForm.value.name as string,
        this.selectedMembers.map((m) => m.publicId),
      )
      .subscribe({
        next: async () => {
          const toast = await this.toastCtrl.create({
            message: this.translate.instant('groups.created'),
            duration: 2000,
            position: 'bottom',
            color: 'success',
          });
          await toast.present();
          this.modalCtrl.dismiss(null, 'created');
        },
        error: () => {
          this.saving = false;
          this.errorMessage = 'groups.create-error';
        },
      });
  }
}
