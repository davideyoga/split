import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  ModalController,
  NavController,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { add, chevronForward, peopleOutline } from 'ionicons/icons';

import { LoadingSkeletonComponent } from '../../../components/loading-skeleton/loading-skeleton.component';
import { NotificationBellComponent } from '../../../components/notification-bell/notification-bell.component';
import { ProfileButtonComponent } from '../../../components/profile-button/profile-button.component';
import { Group } from '../../../models/group.model';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';
import { GroupService } from '../../../services/group.service';
import { NewGroupModal } from '../new-group/new-group.modal';

// Tab Gruppi: la lista e' il contenuto principale. La creazione e' una modale
// (NewGroupModal) aperta dal FAB o dall'empty state.
@Component({
  selector: 'app-group-list',
  templateUrl: './group-list.html',
  standalone: true,
  imports: [
    RouterLink,
    TranslatePipe,
    LoadingSkeletonComponent,
    NotificationBellComponent,
    ProfileButtonComponent,
    IonButton,
    IonButtons,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar,
  ],
})
export class GroupList {
  private modalCtrl = inject(ModalController);
  private navCtrl = inject(NavController);
  private groupService = inject(GroupService);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);

  groups: Group[] = [];
  loadError = false;
  loaded = false;

  constructor() {
    addIcons({ add, 'chevron-forward': chevronForward, 'people-outline': peopleOutline });
  }

  // Gli altri membri del gruppo, per il sottotitolo della riga ('' se ci sono
  // solo io).
  otherMembers(group: Group): string {
    const me = this.authService.currentUser()?.publicId;
    return group.members
      .filter((member) => member.publicId !== me)
      .map((member) => member.nickName)
      .join(', ');
  }

  // Non ngOnInit: la pagina resta montata nella tab, e un gruppo puo' sparire
  // altrove (es. togliendo se stessi da group-settings, che torna qui).
  ionViewWillEnter() {
    this.loadGroups();
    this.notificationService.refreshCount();
  }

  loadGroups(onDone?: () => void) {
    this.loadError = false;
    this.groupService.getMyGroups().subscribe({
      next: (groups) => {
        this.groups = groups;
        this.loaded = true;
        onDone?.();
      },
      error: () => {
        this.loadError = true;
        onDone?.();
      },
    });
  }

  refresh(event: Event) {
    this.loadGroups(() => (event.target as HTMLIonRefresherElement).complete());
  }

  async openNewGroup() {
    const modal = await this.modalCtrl.create({ component: NewGroupModal });
    await modal.present();

    // Appena creato il gruppo ha solo te: si apre sui Membri, dove c'e' il
    // link d'invito.
    const { data, role } = await modal.onWillDismiss<Group>();
    if (role === 'created' && data) {
      this.navCtrl.navigateForward(['/tabs/groups', data.publicId], {
        queryParams: { segment: 'members' },
      });
    }
  }
}
