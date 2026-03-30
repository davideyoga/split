import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, Validators } from '@angular/forms';
import { IonLabel, IonContent, IonHeader, IonTitle, IonToolbar, IonFooter, IonIcon, IonButton, IonButtons, IonItem, IonList, IonBackButton, ModalController, IonChip } from '@ionic/angular/standalone';
import { ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { User } from '../../models/user.model';
import { ParticipantSelectionService } from '../../services/participant-selection-service';
import { SelectParticipantComponent } from '../../components/select-participant/select-participant.component';
import {TranslatePipe, TranslateDirective} from "@ngx-translate/core";

@Component({
  selector: 'app-add-expense',
  templateUrl: './add-expense.html',
  styleUrls: ['./add-expense.scss'],
  standalone: true,
  imports: [IonLabel, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, ReactiveFormsModule, IonFooter, IonIcon, IonButton, IonButtons, IonItem, IonList,
    IonBackButton, TranslatePipe, TranslateDirective, IonChip, IonChip, IonIcon, IonLabel
  ]
})
export class addExpense implements OnInit, OnDestroy {

  private fb = inject(FormBuilder);
  private modalCtrl= inject(ModalController);
  private dataSharingService = inject(ParticipantSelectionService);

  creator: User | null = null;

  //lista contributori alla spesa
  participants: User[] = [];


  selectedParticipantEmail: User | null = null;
  private participantSubscription!: Subscription;

  // 1. Dichiara la variabile per il nostro form
  expenseForm!: FormGroup;

  ngOnInit() {

    // Creiamo la struttura del form e le sue regole di validazione
    this.expenseForm = this.fb.group({
      creator: this.fb.group({
        publicId: [''],
        nickName: ['']
      }), 
      participants: this.fb.array([]),
      amount: [null, [Validators.required, Validators.min(0.01)]],
    });
    
    // Mettiamoci in ascolto dei cambiamenti dal servizio
    this.participantSubscription = this.dataSharingService.selectedParticipant$
      .subscribe((newParticipant: User) => {
        if (newParticipant) {
          
          this.participants.push(newParticipant);
        }
      });
  }

  

  async openParticipantModal() {
    const modal = await this.modalCtrl.create({
      component: SelectParticipantComponent, // Specifica quale componente aprire
    });
    await modal.present();
  }

  removeParticipant(participant: User) {//TODO: fare in modo che non si possa selezionare 2 volte lo stesso utente
    this.participants = this.participants.filter(p => p !== participant);
  }

  // È una best practice cancellare le iscrizioni per evitare memory leak
  ngOnDestroy() {
    if (this.participantSubscription) {
      this.participantSubscription.unsubscribe();
    }
  }

  // 4. Questo è il metodo che verrà chiamato al submit del form
  createExpense() {
    // Per ora, ci limitiamo a stampare i dati in console per verificare
    console.log('Form inviato!');
    console.log('Dati:', this.expenseForm.value);
    console.log('Stato di validità:', this.expenseForm.valid);

    // In futuro, qui faremo la chiamata HTTP al nostro backend
  }

}
