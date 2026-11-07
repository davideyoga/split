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
  NavController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { exitOutline, trashOutline } from 'ionicons/icons';

import { Group } from '../../../models/group.model';
import { User } from '../../../models/user.model';
import { AuthService } from '../../../services/auth.service';
import { GroupService } from '../../../services/group.service';
import { initialOf } from '../../../utils/initial';

// Impostazioni di un gruppo: rinomina e rimozione dei membri, fuori dal
// dettaglio (un contenitore a segmenti Spese/Saldi/Membri). Si entra solo col
// link d'invito, che sta nel segmento Membri (2026-11-07).
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
  initial = initialOf;

  nameForm = this.fb.group({
    name: ['', Validators.required],
  });

  constructor() {
    addIcons({ 'exit-outline': exitOutline, 'trash-outline': trashOutline });
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

  async confirmRemoveMember(member: User) {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('groups.remove-member-confirm', {
        name: member.nickName,
      }),
      buttons: [
        { text: this.translate.instant('groups.cancel'), role: 'cancel' },
        { text: this.translate.instant('groups.remove'), role: 'destructive' },
      ],
    });
    await alert.present();

    // Si aspetta la chiusura dell'alert invece di usare `handler`: Ionic
    // esegue gli handler dei bottoni fuori dalla zona di Angular, quindi quello
    // che cambia dopo (liste ricaricate, errori) non verrebbe ridisegnato.
    const { role } = await alert.onWillDismiss();
    if (role === 'destructive') {
      this.removeMember(member);
    }
  }

  async confirmLeave() {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('groups.leave-confirm', { group: this.group?.name ?? '' }),
      message: this.translate.instant('groups.leave-message'),
      buttons: [
        { text: this.translate.instant('groups.cancel'), role: 'cancel' },
        { text: this.translate.instant('groups.leave'), role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onWillDismiss();
    if (role === 'destructive') {
      this.removeMember({ publicId: this.mePublicId, nickName: '' });
    }
  }

  private removeMember(member: User) {
    this.errorMessage = '';
    this.groupService.removeMember(this.publicId, member.publicId).subscribe({
      next: () => {
        // Chi toglie se stesso perde l'accesso al gruppo: restare qui (o
        // tornare al dettaglio) darebbe solo un 403.
        if (member.publicId === this.mePublicId) {
          this.presentToast('groups.left');
          this.navCtrl.navigateBack('/tabs/groups');
          return;
        }
        this.presentToast('groups.member-removed');
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
