import { Component, inject, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
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
  IonNote,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  add,
  cardOutline,
  close,
  people,
  peopleOutline,
  pieChartOutline,
} from 'ionicons/icons';

import {
  ParticipantSelection,
  SelectParticipantComponent,
} from '../../components/select-participant/select-participant.component';
import {
  ShareMap,
  SplitSharesModal,
} from '../../components/split-shares/split-shares.modal';
import { Category, CATEGORY_ICONS } from '../../models/category.model';
import { Group } from '../../models/group.model';
import { User } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { CategoryService } from '../../services/category.service';
import { ExpenseListItem, ExpenseService } from '../../services/expense.service';
import { GroupService } from '../../services/group.service';
import { formatCents, toCents } from '../../utils/balance';
import { isEqualSplit } from '../../utils/split';

// Nuova spesa o modifica di una esistente, come modale.
// - Creazione: pre-contestualizzata dal punto di partenza (aperta dal dettaglio
//   di un gruppo riceve `group` gia' selezionato). Chiude con
//   `dismiss(null, 'created')` dopo il salvataggio (il chiamante ricarica la
//   sua lista).
// - Modifica (`expense` in componentProps, dal dettaglio spesa): precompila
//   tutto e chiude con `dismiss(spesaAggiornata, 'updated')`.
// In entrambi i casi `dismiss(null, 'cancel')` se si annulla.
@Component({
  selector: 'app-expense-form',
  templateUrl: './expense-form.modal.html',
  styleUrls: ['./expense-form.modal.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
    IonNote,
    IonSelect,
    IonSelectOption,
    IonText,
    IonTitle,
    IonToolbar,
  ],
})
export class ExpenseFormModal implements OnInit {
  // Gruppo precompilato (componentProps). Resta rimovibile dall'utente.
  @Input() group?: Group;
  // Spesa da modificare: se presente la modale e' in modalita' modifica.
  @Input() expense?: ExpenseListItem;

  private fb = inject(FormBuilder);
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);
  private authService = inject(AuthService);
  private expenseService = inject(ExpenseService);
  private categoryService = inject(CategoryService);
  private groupService = inject(GroupService);

  // Chi ha creato la spesa: e' sempre un contributore (lo impone il backend) e
  // non si puo' togliere. In creazione e' l'utente loggato, in modifica il
  // creatore originale, che puo' essere un altro.
  creator: User | null = null;
  mePublicId = '';
  // In modifica, false finche' non si conoscono i membri del gruppo (servono per
  // distinguere i partecipanti singoli da quelli portati dal gruppo).
  ready = true;

  // Partecipanti singoli aggiunti oltre al gruppo.
  participants: User[] = [];

  // Una spesa -> al massimo un gruppo (schema Expense.groupId): il backend
  // espande i membri in singole quote.
  selectedGroup: Group | null = null;

  // Chi ha pagato: di default il creatore, ma si puo' scegliere chiunque
  // partecipi (vedi payerCandidates).
  paidByPublicId = '';
  payerCandidates: User[] = [];

  // Divisione diseguale (modale SplitSharesModal): centesimi per publicId,
  // null = divisione equa. Chi non compare ha quota 0. Non si ricalcola quando
  // cambiano importo o partecipanti: se le quote non fanno piu' il totale la
  // riga "Divisione" lo segnala e il salvataggio resta bloccato.
  customShares: ShareMap | null = null;

  // Categorie disponibili: preconfigurate + quelle create dall'utente.
  categories: Category[] = [];
  selectedCategory: Category | null = null;
  showNewCategoryInput = false;
  newCategoryName = '';

  errorMessage = '';
  saving = false;

  expenseForm = this.fb.group({
    amount: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/), Validators.min(0.01)]],
    description: [''],
  });

  constructor() {
    addIcons({
      add,
      close,
      people,
      'people-outline': peopleOutline,
      'card-outline': cardOutline,
      'pie-chart-outline': pieChartOutline,
      ...CATEGORY_ICONS,
    });
  }

  get isEdit(): boolean {
    return !!this.expense;
  }

  ngOnInit() {
    const me = this.authService.currentUser();
    this.mePublicId = me?.publicId ?? '';

    if (this.expense) {
      this.initFromExpense(this.expense);
    } else {
      this.creator = me;
      this.paidByPublicId = this.creator?.publicId ?? '';
      this.selectedGroup = this.group ?? null;
      this.refreshPayerCandidates();
    }
    this.loadCategories();
  }

  private initFromExpense(expense: ExpenseListItem) {
    this.ready = false;
    this.creator = expense.createdBy;
    this.paidByPublicId = expense.paidBy.publicId;
    this.expenseForm.patchValue({
      amount: formatCents(toCents(expense.amount)),
      description: expense.description,
    });
    this.selectedCategory = expense.category
      ? { ...expense.category, isCustom: !expense.category.slug }
      : null;

    // Il backend non salva la modalita' di divisione: quote che differiscono di
    // piu' di un centesimo = divisione personalizzata.
    const shareCents = expense.expenseContributions.map((c) => toCents(c.share));
    if (!isEqualSplit(shareCents)) {
      const shares: ShareMap = {};
      expense.expenseContributions.forEach((c, i) => {
        shares[c.user.publicId] = shareCents[i];
      });
      this.customShares = shares;
    }

    const contributors = expense.expenseContributions.map((c) => c.user);
    const group = expense.group;
    if (!group) {
      this.setEditParticipants(contributors, []);
      return;
    }

    this.groupService.getGroup(group.publicId).subscribe({
      next: (loaded) => {
        this.selectedGroup = loaded;
        this.setEditParticipants(contributors, loaded.members);
      },
      // Non sono (piu') membro del gruppo, quindi non ne conosco i membri:
      // tratto tutti i contributori come membri. Non mando partecipanti singoli
      // e il backend ricalcola le quote dai membri attuali del gruppo.
      error: () => {
        this.selectedGroup = { ...group, members: contributors };
        this.setEditParticipants(contributors, contributors);
      },
    });
  }

  // Partecipanti singoli = contributori tolti il creatore e i membri del
  // gruppo: e' la stessa regola con cui il backend li ricava se omessi.
  private setEditParticipants(contributors: User[], groupMembers: User[]) {
    const excluded = new Set([
      this.creator?.publicId,
      ...groupMembers.map((m) => m.publicId),
    ]);
    this.participants = contributors.filter((u) => !excluded.has(u.publicId));
    this.refreshPayerCandidates();
    this.ready = true;
  }

  // Quota equa a testa, come la calcola il backend (round a 2 decimali).
  // null se l'importo non e' ancora valido.
  get sharePerHead(): string | null {
    const amount = this.expenseForm.get('amount');
    if (!amount?.valid || this.payerCandidates.length === 0) {
      return null;
    }
    return formatCents(Math.round(toCents(amount.value) / this.payerCandidates.length));
  }

  // Importo in centesimi, null se non ancora valido.
  get amountCents(): number | null {
    const amount = this.expenseForm.get('amount');
    return amount?.valid ? toCents(amount.value) : null;
  }

  // Con quote personalizzate: quanto manca (> 0) o avanza (< 0) al totale.
  // 0 con divisione equa o importo non ancora valido.
  get splitRemainingCents(): number {
    const total = this.amountCents;
    if (!this.customShares || total === null) {
      return 0;
    }
    const assigned = this.payerCandidates.reduce(
      (sum, user) => sum + (this.customShares?.[user.publicId] ?? 0),
      0,
    );
    return total - assigned;
  }

  formatCents(cents: number): string {
    return formatCents(cents);
  }

  async openSplitModal() {
    const totalCents = this.amountCents;
    if (totalCents === null || this.payerCandidates.length < 2) {
      return;
    }

    const modal = await this.modalCtrl.create({
      component: SplitSharesModal,
      componentProps: {
        totalCents,
        people: this.payerCandidates,
        shares: this.customShares,
        paidByPublicId: this.paidByPublicId,
        mePublicId: this.mePublicId,
      },
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss<ShareMap | null>();
    if (role === 'confirmed') {
      this.customShares = data ?? null;
    }
  }

  // Quote da mandare al backend: una per contributore, in euro.
  private sharesPayload() {
    return this.customShares
      ? this.payerCandidates.map((user) => ({
          userPublicId: user.publicId,
          share: (this.customShares?.[user.publicId] ?? 0) / 100,
        }))
      : null;
  }

  loadCategories() {
    this.categoryService.getCategories().subscribe({
      next: (categories) => {
        // In modifica la categoria della spesa puo' non essere fra le mie
        // (custom di chi l'ha creata, o archiviata): la aggiungo per mostrarla
        // selezionata. Il backend non la ricontrolla se resta invariata.
        const selected = this.selectedCategory;
        this.categories =
          selected && !categories.some((c) => c.publicId === selected.publicId)
            ? [...categories, selected]
            : categories;
      },
    });
  }

  // La categoria è facoltativa: ricliccando su quella selezionata si deseleziona.
  toggleCategory(category: Category) {
    this.selectedCategory =
      this.selectedCategory?.publicId === category.publicId ? null : category;
  }

  toggleNewCategoryInput() {
    this.showNewCategoryInput = !this.showNewCategoryInput;
    this.newCategoryName = '';
  }

  // Crea al volo una categoria custom dell'utente e la seleziona.
  createCategory() {
    const name = this.newCategoryName.trim();
    if (!name) {
      return;
    }

    this.categoryService.createCategory(name).subscribe({
      next: (category) => {
        this.categories = [...this.categories, category];
        this.selectedCategory = category;
        this.showNewCategoryInput = false;
        this.newCategoryName = '';
      },
      error: (err: HttpErrorResponse) => {
        // 409 = l'utente ha già una categoria con quel nome.
        this.errorMessage =
          err.status === 409
            ? 'categories.duplicate-error'
            : 'categories.create-error';
      },
    });
  }

  async openParticipantModal() {
    const modal = await this.modalCtrl.create({
      component: SelectParticipantComponent,
    });
    await modal.present();

    const { data } = await modal.onWillDismiss<ParticipantSelection>();
    const user = data?.user;
    if (user && !this.participants.some((p) => p.publicId === user.publicId)) {
      this.participants = [...this.participants, user];
    }
    if (data?.group) {
      this.selectedGroup = data.group;
    }
    this.refreshPayerCandidates();
  }

  removeParticipant(participant: User) {
    this.participants = this.participants.filter((p) => p !== participant);
    this.refreshPayerCandidates();
  }

  removeGroup() {
    this.selectedGroup = null;
    this.refreshPayerCandidates();
  }

  // Chi puo' aver pagato = creatore + partecipanti scelti + membri del gruppo,
  // deduplicati: e' lo stesso insieme di contributori che ricostruisce il
  // backend, che rifiuta un pagante fuori da questo insieme.
  private refreshPayerCandidates() {
    const candidates: User[] = [];
    const seen = new Set<string>();

    for (const user of [
      ...(this.creator ? [this.creator] : []),
      ...this.participants,
      ...(this.selectedGroup?.members ?? []),
    ]) {
      if (user?.publicId && !seen.has(user.publicId)) {
        seen.add(user.publicId);
        candidates.push(user);
      }
    }

    this.payerCandidates = candidates;

    // Rimasto solo il creatore non c'e' niente da dividere: torna equa.
    if (candidates.length < 2) {
      this.customShares = null;
    }

    // Se chi avevo scelto non partecipa piu' (partecipante o gruppo rimosso),
    // il pagante torna a essere il creatore.
    if (!seen.has(this.paidByPublicId)) {
      this.paidByPublicId = this.creator?.publicId ?? '';
    }
  }

  // Ripulisce l'importo digitato lasciando solo cifre e un'unica virgola/punto decimale
  sanitizeAmountInput(event: Event) {
    const detail = (event as CustomEvent<{ value?: string | null }>).detail;
    let value = (detail.value ?? '').replace(',', '.').replace(/[^0-9.]/g, '');

    const firstDot = value.indexOf('.');
    if (firstDot !== -1) {
      value = value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, '');
    }

    this.expenseForm.get('amount')?.setValue(value);
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  get canSave(): boolean {
    return (
      this.expenseForm.valid &&
      !this.saving &&
      this.ready &&
      this.splitRemainingCents === 0
    );
  }

  save() {
    if (!this.canSave) {
      return;
    }

    this.errorMessage = '';
    this.saving = true;

    if (this.expense) {
      this.updateExpense(this.expense.publicId);
    } else {
      this.createExpense();
    }
  }

  // Manda sempre tutti i campi: `null` toglie gruppo/categoria, una
  // descrizione vuota la cancella.
  private updateExpense(publicId: string) {
    this.expenseService.update(publicId, {
      description: this.expenseForm.value.description?.trim() ?? '',
      amount: Number(this.expenseForm.value.amount),
      participantPublicIds: this.participants.map((p) => p.publicId),
      paidByPublicId: this.paidByPublicId || undefined,
      groupPublicId: this.selectedGroup?.publicId ?? null,
      categoryPublicId: this.selectedCategory?.publicId ?? null,
      shares: this.sharesPayload(),
    }).subscribe({
      next: async (updated) => {
        await this.presentSuccessToast('expense-form.updated');
        this.modalCtrl.dismiss(updated, 'updated');
      },
      error: () => {
        this.saving = false;
        this.errorMessage = 'expense-form.update-error';
      },
    });
  }

  private createExpense() {
    this.expenseService.create({
      description: this.expenseForm.value.description?.trim() || undefined,
      amount: Number(this.expenseForm.value.amount),
      participantPublicIds: this.participants.map((p) => p.publicId),
      paidByPublicId: this.paidByPublicId || undefined,
      groupPublicId: this.selectedGroup?.publicId,
      categoryPublicId: this.selectedCategory?.publicId,
      shares: this.sharesPayload() ?? undefined,
    }).subscribe({
      next: async () => {
        await this.presentSuccessToast('expense-form.created');
        this.modalCtrl.dismiss(null, 'created');
      },
      error: () => {
        this.saving = false;
        this.errorMessage = 'expense-form.create-error';
      },
    });
  }

  private async presentSuccessToast(messageKey: string) {
    const toast = await this.toastCtrl.create({
      message: this.translate.instant(messageKey),
      duration: 2000,
      position: 'bottom',
      color: 'success',
    });
    await toast.present();
  }
}
