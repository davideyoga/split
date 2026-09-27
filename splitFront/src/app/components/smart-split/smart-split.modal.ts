import { Component, inject, Input, OnInit } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { sparklesOutline } from 'ionicons/icons';
import { forkJoin } from 'rxjs';

import { SMART_SPLIT_SLUG } from '../../models/category.model';
import { Group } from '../../models/group.model';
import { User } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { CategoryService } from '../../services/category.service';
import { CreateExpensePayload, ExpenseService } from '../../services/expense.service';
import { GroupService } from '../../services/group.service';
import { formatCents } from '../../utils/balance';
import { planRebalance, RebalanceExpense, RebalancePlan } from '../../utils/simplify';

// Divisione intelligente, aperta dal segmento Saldi del gruppo. Ricarica gruppo
// e spese (non usa quelle della pagina, possono essere vecchie), calcola con
// `planRebalance` le spese di compensazione che riducono i pagamenti, le mostra
// in anteprima e alla conferma le crea tutte insieme (POST /api/expense/batch).
// Chiude con `dismiss(spese create, 'applied')` o `dismiss(null, 'cancel')`.
@Component({
  selector: 'app-smart-split',
  templateUrl: './smart-split.modal.html',
  standalone: true,
  imports: [
    TranslatePipe,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonNote,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
  ],
})
export class SmartSplitModal implements OnInit {
  @Input({ required: true }) group!: Group;

  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);
  private authService = inject(AuthService);
  private categoryService = inject(CategoryService);
  private expenseService = inject(ExpenseService);
  private groupService = inject(GroupService);

  loading = true;
  loadError = false;
  saving = false;
  errorMessage = '';
  plan: RebalancePlan | null = null;

  mePublicId = this.authService.currentUser()?.publicId ?? '';
  format = formatCents;

  private categoryPublicId = '';

  constructor() {
    addIcons({ 'sparkles-outline': sparklesOutline });
  }

  ngOnInit() {
    // I membri servono freschi: il backend vuole le quote di esattamente tutti
    // i membri attuali, e uno aggiunto nel frattempo farebbe fallire il salvataggio.
    forkJoin({
      group: this.groupService.getGroup(this.group.publicId),
      expenses: this.expenseService.listByGroup(this.group.publicId),
      categories: this.categoryService.getCategories(),
    }).subscribe({
      next: ({ group, expenses, categories }) => {
        const category = categories.find((c) => c.slug === SMART_SPLIT_SLUG);
        // Senza la categoria (seed non rilanciato, o categorie non caricate:
        // getCategories risponde [] in caso di errore) non si crea niente.
        if (!category) {
          this.loadError = true;
        } else {
          this.group = group;
          this.categoryPublicId = category.publicId;
          this.plan = planRebalance(expenses);
        }
        this.loading = false;
      },
      error: () => {
        this.loadError = true;
        this.loading = false;
      },
    });
  }

  get canApply(): boolean {
    return !this.loading && !this.saving && (this.plan?.expenses.length ?? 0) > 0;
  }

  isMe(user: User): boolean {
    return user.publicId === this.mePublicId;
  }

  label(user: User): string {
    return this.isMe(user) ? this.translate.instant('smart-split.you') : user.nickName;
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  apply() {
    if (!this.canApply || !this.plan) {
      return;
    }
    this.errorMessage = '';
    this.saving = true;

    this.expenseService.createMany(this.plan.expenses.map((e) => this.toPayload(e))).subscribe({
      next: async (created) => {
        const toast = await this.toastCtrl.create({
          message: this.translate.instant('smart-split.applied'),
          duration: 2000,
          position: 'bottom',
          color: 'success',
        });
        await toast.present();
        this.modalCtrl.dismiss(created, 'applied');
      },
      error: () => {
        this.saving = false;
        this.errorMessage = 'smart-split.save-error';
      },
    });
  }

  // Una spesa del gruppo senza descrizione (il titolo lo traduce il frontend,
  // vedi `isSmartSplit`). Il backend vuole una quota per ogni contributore,
  // cioe' creatore + partecipanti + membri attuali: chi non e' toccato ha 0.
  // Chi e' coinvolto ma non e' (piu') membro, ad esempio un partecipante
  // aggiunto a mano a una spesa del gruppo, va passato come partecipante.
  private toPayload(expense: RebalanceExpense): CreateExpensePayload {
    const memberIds = this.group.members.map((m) => m.publicId);
    const involvedIds = [expense.payer.publicId, ...expense.shares.map((s) => s.user.publicId)];
    const participantIds = involvedIds.filter(
      (id) => id !== this.mePublicId && !memberIds.includes(id),
    );
    const contributorIds = [...new Set([this.mePublicId, ...participantIds, ...memberIds])];
    const shareByUser = new Map(expense.shares.map((s) => [s.user.publicId, s.cents]));

    return {
      amount: expense.totalCents / 100,
      participantPublicIds: participantIds,
      paidByPublicId: expense.payer.publicId,
      groupPublicId: this.group.publicId,
      categoryPublicId: this.categoryPublicId,
      shares: contributorIds.map((id) => ({
        userPublicId: id,
        share: (shareByUser.get(id) ?? 0) / 100,
      })),
    };
  }
}
