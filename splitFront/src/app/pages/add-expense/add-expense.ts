import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, Validators } from '@angular/forms';
import { IonLabel, IonContent, IonHeader, IonTitle, IonToolbar, IonFooter, IonIcon, IonButton, IonButtons, IonItem, IonList, IonBackButton, ModalController, IonChip, IonText, IonInput } from '@ionic/angular/standalone';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { checkmarkDoneOutline, close, people, personAddOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { Group } from '../../models/group.model';
import { User } from '../../models/user.model';
import { ParticipantSelectionService } from '../../services/participant-selection-service';
import { SelectParticipantComponent } from '../../components/select-participant/select-participant.component';
import { AuthService } from '../../services/auth.service';
import { ExpenseService } from '../../services/expense.service';
import {TranslatePipe, TranslateDirective} from "@ngx-translate/core";

@Component({
  selector: 'app-add-expense',
  templateUrl: './add-expense.html',
  styleUrls: ['./add-expense.scss'],
  standalone: true,
  imports: [IonLabel, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, ReactiveFormsModule, IonFooter, IonIcon, IonButton, IonButtons, IonItem, IonList,
    IonBackButton, TranslatePipe, TranslateDirective, IonChip, IonChip, IonIcon, IonLabel, IonText, IonInput
  ]
})
export class addExpense implements OnInit, OnDestroy {

  private fb = inject(FormBuilder);
  private modalCtrl= inject(ModalController);
  private participantSelection = inject(ParticipantSelectionService);
  private authService = inject(AuthService);
  private expenseService = inject(ExpenseService);
  private router = inject(Router);

  creator: User | null = null;

  //lista contributori alla spesa
  participants: User[] = [];

  // Gruppo opzionale a cui legare la spesa: il backend espande i membri in
  // singole quote. Una sola spesa -> un solo gruppo (schema Expense.groupId).
  selectedGroup: Group | null = null;

  selectedParticipantEmail: User | null = null;
  errorMessage = '';
  private participantSubscription!: Subscription;
  private groupSubscription!: Subscription;

  // 1. Dichiara la variabile per il nostro form
  expenseForm!: FormGroup;

  constructor() {
    addIcons({
      people,
      close,
      'person-add-outline': personAddOutline,
      'checkmark-done-outline': checkmarkDoneOutline,
    });
  }

  ngOnInit() {

    // Creiamo la struttura del form e le sue regole di validazione
    this.expenseForm = this.fb.group({
      creator: this.fb.group({
        publicId: [''],
        nickName: ['']
      }),
      participants: this.fb.array([]),
      amount: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/), Validators.min(0.01)]],
      description: ['', Validators.required],
    });

    // Precompiliamo il creatore con l'utente attualmente loggato
    this.creator = this.authService.currentUser();
    if (this.creator) {
      this.expenseForm.get('creator')?.patchValue(this.creator);
    }

    // Mettiamoci in ascolto dei cambiamenti dal servizio
    this.participantSubscription = this.participantSelection.selectedParticipant$
      .subscribe((newParticipant: User) => {
        if (
          newParticipant &&
          !this.participants.some((p) => p.publicId === newParticipant.publicId)
        ) {
          this.participants.push(newParticipant);
        }
      });

    this.groupSubscription = this.participantSelection.selectedGroup$
      .subscribe((group: Group) => {
        if (group) {
          this.selectedGroup = group;
        }
      });
  }



  async openParticipantModal() {
    const modal = await this.modalCtrl.create({
      component: SelectParticipantComponent, // Specifica quale componente aprire
    });
    await modal.present();
  }

  removeParticipant(participant: User) {
    this.participants = this.participants.filter(p => p !== participant);
  }

  removeGroup() {
    this.selectedGroup = null;
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

  // È una best practice cancellare le iscrizioni per evitare memory leak
  ngOnDestroy() {
    this.participantSubscription?.unsubscribe();
    this.groupSubscription?.unsubscribe();
  }

  // 4. Questo è il metodo che verrà chiamato al submit del form
  createExpense() {
    if (this.expenseForm.invalid) {
      return;
    }

    this.errorMessage = '';

    this.expenseService.create({
      description: this.expenseForm.value.description,
      amount: Number(this.expenseForm.value.amount),
      participantPublicIds: this.participants.map((p) => p.publicId),
      groupPublicId: this.selectedGroup?.publicId,
    }).subscribe({
      next: () => this.router.navigateByUrl('/home'),
      error: () => {
        this.errorMessage = 'add-expense.create-error';
      }
    });
  }

}
