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
import { Category, CATEGORY_ICONS } from '../../models/category.model';
import { Group } from '../../models/group.model';
import { User } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { CategoryService } from '../../services/category.service';
import { ExpenseService } from '../../services/expense.service';
import { formatCents, toCents } from '../../utils/balance';

// Nuova spesa come modale, pre-contestualizzata dal punto di partenza: aperta
// dal dettaglio di un gruppo riceve `group` gia' selezionato. Chiude con
// `dismiss(null, 'created')` dopo il salvataggio (il chiamante ricarica la sua
// lista) o `dismiss(null, 'cancel')`. Solo creazione: la modifica richiede
// endpoint GET/PATCH /api/expense/:id che il backend non ha ancora.
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

  private fb = inject(FormBuilder);
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);
  private authService = inject(AuthService);
  private expenseService = inject(ExpenseService);
  private categoryService = inject(CategoryService);

  creator: User | null = null;

  // Partecipanti singoli aggiunti oltre al gruppo.
  participants: User[] = [];

  // Una spesa -> al massimo un gruppo (schema Expense.groupId): il backend
  // espande i membri in singole quote.
  selectedGroup: Group | null = null;

  // Chi ha pagato: di default il creatore, ma si puo' scegliere chiunque
  // partecipi (vedi payerCandidates).
  paidByPublicId = '';
  payerCandidates: User[] = [];

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

  ngOnInit() {
    this.creator = this.authService.currentUser();
    this.paidByPublicId = this.creator?.publicId ?? '';
    this.selectedGroup = this.group ?? null;
    this.refreshPayerCandidates();
    this.loadCategories();
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

  loadCategories() {
    this.categoryService.getCategories().subscribe({
      next: (categories) => (this.categories = categories),
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

  createExpense() {
    if (this.expenseForm.invalid || this.saving) {
      return;
    }

    this.errorMessage = '';
    this.saving = true;

    this.expenseService.create({
      description: this.expenseForm.value.description?.trim() || undefined,
      amount: Number(this.expenseForm.value.amount),
      participantPublicIds: this.participants.map((p) => p.publicId),
      paidByPublicId: this.paidByPublicId || undefined,
      groupPublicId: this.selectedGroup?.publicId,
      categoryPublicId: this.selectedCategory?.publicId,
    }).subscribe({
      next: async () => {
        await this.presentCreatedToast();
        this.modalCtrl.dismiss(null, 'created');
      },
      error: () => {
        this.saving = false;
        this.errorMessage = 'expense-form.create-error';
      },
    });
  }

  private async presentCreatedToast() {
    const toast = await this.toastCtrl.create({
      message: this.translate.instant('expense-form.created'),
      duration: 2000,
      position: 'bottom',
      color: 'success',
    });
    await toast.present();
  }
}
