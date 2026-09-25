import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  AlertController,
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
  IonListHeader,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
  NavController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { personAddOutline, trashOutline } from 'ionicons/icons';

import {
  ParticipantSelection,
  SelectParticipantComponent,
} from '../../../components/select-participant/select-participant.component';
import { Group } from '../../../models/group.model';
import { User } from '../../../models/user.model';
import { AuthService } from '../../../services/auth.service';
import { GroupService } from '../../../services/group.service';

// Impostazioni di un gruppo: rinomina e gestione membri, spostate fuori dal
// dettaglio (che ora e' un contenitore a segmenti Spese/Saldi/Membri).
@Component({
  selector: 'app-group-settings',
  templateUrl: './group-settings.page.html',
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
    IonListHeader,
    IonText,
    IonTitle,
    IonToolbar,
  ],
})
export class GroupSettingsPage implements OnInit {
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private navCtrl = inject(NavController);
  private translate = inject(TranslateService);
  private authService = inject(AuthService);
  private groupService = inject(GroupService);

  group: Group | null = null;
  loadError = false;
  errorMessage = '';
  publicId = '';
  mePublicId = this.authService.currentUser()?.publicId ?? '';

  nameForm = this.fb.group({
    name: ['', Validators.required],
  });

  constructor() {
    addIcons({
      'person-add-outline': personAddOutline,
      'trash-outline': trashOutline,
    });
  }

  ngOnInit() {
    this.publicId = this.route.snapshot.paramMap.get('publicId') ?? '';
    this.loadGroup();
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

  async openMemberModal() {
    const modal = await this.modalCtrl.create({
      component: SelectParticipantComponent,
      componentProps: { allowGroups: false },
    });
    await modal.present();

    const { data } = await modal.onWillDismiss<ParticipantSelection>();
    if (data?.user) {
      this.addMember(data.user);
    }
  }

  addMember(member: User) {
    if (this.group?.members.some((m) => m.publicId === member.publicId)) {
      return;
    }
    this.errorMessage = '';
    this.groupService.addMembers(this.publicId, [member.publicId]).subscribe({
      next: (group) => {
        this.group = group;
        this.presentToast('groups.member-added');
      },
      error: () => (this.errorMessage = 'groups.member-error'),
    });
  }

  async confirmRemoveMember(member: User) {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('groups.remove-member-confirm', {
        name: member.nickName,
      }),
      buttons: [
        { text: this.translate.instant('groups.cancel'), role: 'cancel' },
        {
          text: this.translate.instant('groups.remove'),
          role: 'destructive',
          handler: () => this.removeMember(member),
        },
      ],
    });
    await alert.present();
  }

  private removeMember(member: User) {
    this.errorMessage = '';
    this.groupService.removeMember(this.publicId, member.publicId).subscribe({
      next: () => {
        this.presentToast('groups.member-removed');
        // Chi toglie se stesso perde l'accesso al gruppo: restare qui (o
        // tornare al dettaglio) darebbe solo un 403.
        if (member.publicId === this.mePublicId) {
          this.navCtrl.navigateBack('/tabs/groups');
          return;
        }
        this.loadGroup();
      },
      error: () => (this.errorMessage = 'groups.member-error'),
    });
  }

  private async presentToast(messageKey: string) {
    const toast = await this.toastCtrl.create({
      message: this.translate.instant(messageKey),
      duration: 2000,
      position: 'bottom',
      color: 'success',
    });
    await toast.present();
  }
}
