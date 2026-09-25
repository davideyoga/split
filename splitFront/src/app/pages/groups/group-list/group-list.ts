import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { add, people } from 'ionicons/icons';

import { Group } from '../../../models/group.model';
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
    IonButton,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar,
  ],
})
export class GroupList {
  private modalCtrl = inject(ModalController);
  private groupService = inject(GroupService);

  groups: Group[] = [];
  loadError = false;
  loaded = false;

  constructor() {
    addIcons({ add, people });
  }

  // Non ngOnInit: la pagina resta montata nella tab, e un gruppo puo' sparire
  // altrove (es. togliendo se stessi da group-settings, che torna qui).
  ionViewWillEnter() {
    this.loadGroups();
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

    const { role } = await modal.onWillDismiss();
    if (role === 'created') {
      this.loadGroups();
    }
  }
}
