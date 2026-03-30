import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, ModalController, IonButton, IonSearchbar, IonButtons, IonSpinner } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { User } from '../../models/user.model';
import { ParticipantSelectionService } from '../../services/participant-selection-service';
import { UserService } from '../../services/user.service';


@Component({
  selector: 'app-select-participant',
  templateUrl: './select-participant.component.html',
  styleUrls: ['./select-participant.component.scss'],
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonButton, IonButtons, IonSearchbar, FormsModule, IonSpinner],
})

export class SelectParticipantComponent{

  private userService = inject(UserService);
  private modalCtrl= inject(ModalController);
  private participantSelectionService = inject(ParticipantSelectionService);

  searchResults: User[] = [];
  searchQuery = '';
  isLoading = false;

  // Metodo chiamato ogni volta che l'utente digita nella barra di ricerca
  searchUsers() {
    if (this.searchQuery.trim().length < 3) {
      this.searchResults = [];
      return;
    }

    this.isLoading = true;
    this.searchResults = []; 
    //subscription to getUsers
    this.userService.getUsers(this.searchQuery).subscribe((users) => {
      //abilito spinner
      this.searchResults = users;
      this.isLoading = false;
    });
  }

  // Metodo chiamato quando l'utente seleziona un risultato dalla lista//TODO: passare tutto lo user, non solo la mail 
  selectParticipant(selectedParticipant: User) {
    // Passiamo il nickName indietro invece dell'email
    this.participantSelectionService.selectParticipant(selectedParticipant);
    this.modalCtrl.dismiss();
  }

  // Metodo opzionale per chiudere il modale senza selezionare nulla
  dismissModal() {
    this.modalCtrl.dismiss();
  }

}
