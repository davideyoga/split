import { Component, inject, Input, OnChanges } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  AlertController,
  IonButton,
  IonIcon,
  IonInput,
  IonLabel,
  IonListHeader,
  IonNote,
  IonSelect,
  IonSelectOption,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { copyOutline, linkOutline, shareSocialOutline } from 'ionicons/icons';

import { ActiveInvite, InviteService } from '../../services/invite.service';
import {
  DEFAULT_INVITE_EXPIRY,
  INVITE_EXPIRY_DAYS,
  InviteExpiryDays,
  inviteUrl,
} from '../../utils/invite';

// "Invita con link" nel segmento Membri del gruppo (2026-11-07): nei gruppi si
// entra solo cosi'. Il link si vede solo appena creato (nel DB c'e' solo
// l'hash del token): per ricondividerlo dopo serve un link nuovo, che revoca
// il precedente.
@Component({
  selector: 'app-group-invite',
  templateUrl: './group-invite.component.html',
  styleUrls: ['./group-invite.component.scss'],
  standalone: true,
  imports: [
    DatePipe,
    TranslatePipe,
    IonButton,
    IonIcon,
    IonInput,
    IonLabel,
    IonListHeader,
    IonNote,
    IonSelect,
    IonSelectOption,
  ],
})
export class GroupInviteComponent implements OnChanges {
  @Input({ required: true }) groupPublicId!: string;
  @Input() groupName = '';

  private inviteService = inject(InviteService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);

  readonly expiryChoices = INVITE_EXPIRY_DAYS;
  expiresInDays: InviteExpiryDays = DEFAULT_INVITE_EXPIRY;
  // Il link attivo creato prima (senza token) e quello appena creato.
  active: ActiveInvite | null = null;
  createdUrl: string | null = null;
  createdExpiresAt: string | null = null;
  busy = false;
  readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  constructor() {
    addIcons({
      'copy-outline': copyOutline,
      'link-outline': linkOutline,
      'share-social-outline': shareSocialOutline,
    });
  }

  ngOnChanges() {
    this.createdUrl = null;
    this.createdExpiresAt = null;
    this.loadActive();
  }

  get hasLink(): boolean {
    return !!this.createdUrl || !!this.active;
  }

  onExpiryChange(event: Event) {
    const value = Number((event as CustomEvent<{ value?: number }>).detail.value);
    this.expiresInDays = INVITE_EXPIRY_DAYS.find((days) => days === value) ?? DEFAULT_INVITE_EXPIRY;
  }

  create() {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.inviteService.create(this.groupPublicId, this.expiresInDays).subscribe({
      next: ({ token, expiresAt }) => {
        // L'origine del sito: con l'app nativa (Capacitor) sarebbe
        // https://localhost, vedi doc/InvitiGruppo.md.
        this.createdUrl = inviteUrl(window.location.origin, token);
        this.createdExpiresAt = expiresAt;
        this.active = null;
        this.busy = false;
      },
      error: () => {
        this.busy = false;
        this.presentToast('invite.error', 'danger');
      },
    });
  }

  async share() {
    if (!this.createdUrl) {
      return;
    }
    try {
      await navigator.share({
        title: this.translate.instant('invite.share-title', { group: this.groupName }),
        url: this.createdUrl,
      });
    } catch {
      // Condivisione annullata: niente da fare.
    }
  }

  async copy() {
    if (!this.createdUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(this.createdUrl);
      await this.presentToast('invite.copied', 'success');
    } catch {
      // Senza permesso sugli appunti il link resta selezionabile nel campo.
      await this.presentToast('invite.copy-error', 'danger');
    }
  }

  async confirmRevoke() {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('invite.revoke-confirm'),
      message: this.translate.instant('invite.revoke-message'),
      buttons: [
        { text: this.translate.instant('groups.cancel'), role: 'cancel' },
        { text: this.translate.instant('invite.revoke'), role: 'destructive' },
      ],
    });
    await alert.present();
    // Niente `handler`: Ionic li esegue fuori dalla zona di Angular (vedi
    // CLAUDE.md, pitfall degli alert).
    const { role } = await alert.onWillDismiss();
    if (role === 'destructive') {
      this.revoke();
    }
  }

  private revoke() {
    this.busy = true;
    this.inviteService.revoke(this.groupPublicId).subscribe({
      next: () => {
        this.createdUrl = null;
        this.createdExpiresAt = null;
        this.active = null;
        this.busy = false;
        this.presentToast('invite.revoked', 'success');
      },
      error: () => {
        this.busy = false;
        this.presentToast('invite.error', 'danger');
      },
    });
  }

  private loadActive() {
    this.inviteService.active(this.groupPublicId).subscribe({
      next: ({ invite }) => (this.active = invite),
      error: () => (this.active = null),
    });
  }

  private async presentToast(messageKey: string, color: 'success' | 'danger') {
    const toast = await this.toastCtrl.create({
      message: this.translate.instant(messageKey),
      duration: 2000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
