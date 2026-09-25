import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonBackButton,
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
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { add, ellipsisVertical, settingsOutline } from 'ionicons/icons';

import { ExpenseBalancesComponent } from '../../../components/expense-balances/expense-balances.component';
import { GroupExpensesComponent } from '../../../components/group-expenses/group-expenses.component';
import { ExpenseFormModal } from '../../expense-form/expense-form.modal';
import { Group } from '../../../models/group.model';
import { AuthService } from '../../../services/auth.service';
import { ExpenseListItem } from '../../../services/expense.service';
import { GroupService } from '../../../services/group.service';

type GroupSegment = 'expenses' | 'balances' | 'members';

// Dettaglio gruppo come contenitore a segmenti (Spese / Saldi / Membri).
// Rinomina e gestione membri stanno in group-settings (⋮ nell'header).
@Component({
  selector: 'app-group-detail',
  templateUrl: './group-detail.html',
  styleUrls: ['./group-detail.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TranslatePipe,
    ExpenseBalancesComponent,
    GroupExpensesComponent,
    IonBackButton,
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
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToolbar,
  ],
})
export class GroupDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private modalCtrl = inject(ModalController);
  private authService = inject(AuthService);
  private groupService = inject(GroupService);

  group: Group | null = null;
  // Popolata da `app-group-expenses`, che le carica gia' per la sua lista.
  groupExpenses: ExpenseListItem[] = [];
  loadError = false;
  segment: GroupSegment = 'expenses';

  publicId = '';
  mePublicId = this.authService.currentUser()?.publicId ?? '';

  // Serve per ricaricare la lista dopo aver creato una spesa dalla modale.
  @ViewChild(GroupExpensesComponent) private expensesList?: GroupExpensesComponent;

  constructor() {
    addIcons({
      add,
      'ellipsis-vertical': ellipsisVertical,
      'settings-outline': settingsOutline,
    });
  }

  ngOnInit() {
    this.publicId = this.route.snapshot.paramMap.get('publicId') ?? '';
  }

  // Non ngOnInit: tornando indietro da group-settings la pagina e' ancora
  // montata, e nome/membri potrebbero essere cambiati.
  ionViewWillEnter() {
    this.loadGroup();
  }

  loadGroup(onDone?: () => void) {
    this.loadError = false;
    this.groupService.getGroup(this.publicId).subscribe({
      next: (group) => {
        this.group = group;
        onDone?.();
      },
      error: () => {
        this.loadError = true;
        onDone?.();
      },
    });
  }

  // Ricarica gruppo e spese (che alimentano anche il segmento Saldi); lo
  // spinner si chiude quando sono arrivati entrambi.
  refresh(event: Event) {
    let pending = 2;
    const done = () => {
      if (--pending === 0) {
        (event.target as HTMLIonRefresherElement).complete();
      }
    };
    this.loadGroup(done);
    if (this.expensesList) {
      this.expensesList.loadExpenses(done);
    } else {
      done();
    }
  }

  onSegmentChange(event: Event) {
    const value = (event as CustomEvent<{ value?: GroupSegment }>).detail.value;
    this.segment = value ?? 'expenses';
  }

  // Nuova spesa con il gruppo gia' selezionato: dal dettaglio gruppo e' 1 tap.
  async openExpenseForm() {
    if (!this.group) {
      return;
    }
    const modal = await this.modalCtrl.create({
      component: ExpenseFormModal,
      componentProps: { group: this.group },
    });
    await modal.present();

    const { role } = await modal.onWillDismiss();
    if (role === 'created') {
      this.expensesList?.loadExpenses();
    }
  }
}
