import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
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

import { GroupService } from '../../../services/group.service';

// Nuovo gruppo come modale (aperta dal FAB della lista gruppi), cosi' la lista
// resta il contenuto principale della tab. Chiede solo il nome: gli altri
// entrano col link d'invito (2026-11-07). Chiude con dismiss(group, 'created')
// dopo aver mostrato il toast (la lista apre il gruppo sui Membri, dove c'e'
// il link), o dismiss(null, 'cancel').
@Component({
  selector: 'app-new-group',
  templateUrl: './new-group.modal.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
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

  errorMessage = '';
  saving = false;

  groupForm = this.fb.group({
    name: ['', Validators.required],
  });

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
      .createGroup(this.groupForm.value.name as string)
      .subscribe({
        next: async (group) => {
          const toast = await this.toastCtrl.create({
            message: this.translate.instant('groups.created'),
            duration: 2000,
            position: 'bottom',
            color: 'success',
          });
          await toast.present();
          this.modalCtrl.dismiss(group, 'created');
        },
        error: () => {
          this.saving = false;
          this.errorMessage = 'groups.create-error';
        },
      });
  }
}
