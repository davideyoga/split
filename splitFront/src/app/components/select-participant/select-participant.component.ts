import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, ModalController, IonButton, IonSearchbar, IonButtons } from '@ionic/angular/standalone';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { User } from '../../models/user.model';
import { ParticipantSelectionService } from '../../services/participant-selection-service';


@Component({
  selector: 'app-select-participant',
  templateUrl: './select-participant.component.html',
  styleUrls: ['./select-participant.component.scss'],
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonButton, IonButtons, IonSearchbar, FormsModule],
})

export class SelectParticipantComponent{

  // La lista dei risultati della ricerca, inizialmente vuota
  searchResults: User[] = [];

  // La stringa di ricerca, collegata all'input
  searchQuery: string = '';

  // L'URL del tuo backend (cambia la porta se necessario)
  private apiUrl = 'http://localhost:3000';//TODO: non deve sta qua il link

  constructor(
    private modalCtrl: ModalController,
    private participantSelectionService: ParticipantSelectionService,
    private http: HttpClient // Inietta HttpClient
  ) {}

  // Metodo chiamato ogni volta che l'utente digita nella barra di ricerca
  searchUsers() {
    // Non fare la ricerca se l'input è troppo corto per evitare richieste inutili
    if (this.searchQuery.trim().length < 2) {
      this.searchResults = [];
      return;
    }

    // Fai la chiamata GET al tuo backend
    this.http.get<User[]>(`${this.apiUrl}/user/${this.searchQuery}`)
      .subscribe({
        next: (users) => {
          // In caso di successo, aggiorna la lista dei risultati
          this.searchResults = users;
        },
        error: (err) => {
          // In caso di errore, svuota la lista e stampa l'errore in console
          console.error('Errore durante la ricerca degli utenti', err);//TODO: gestione degli errori da sistemare
          this.searchResults = [];
        }
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
