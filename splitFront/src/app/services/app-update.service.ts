import { inject, Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { ToastController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs';

// Aggiornamenti della PWA. Con il service worker l'app si apre dalla cache:
// dopo un deploy la nuova versione viene scaricata in background e si attiva
// solo al ricaricamento. Qui la si segnala con un toast "Ricarica", senza
// ricaricare da soli (si perderebbe, per esempio, una spesa in compilazione).
@Injectable({
  providedIn: 'root',
})
export class AppUpdateService {
  private swUpdate = inject(SwUpdate);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);

  private prompting = false;

  init() {
    // Spento in development/e2e (vedi main.ts).
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => this.promptReload('update.available'));

    // La cache del service worker e' inconsistente (es. file della versione
    // in uso cancellati dal browser): l'unica via d'uscita e' ricaricare.
    this.swUpdate.unrecoverable.subscribe(() => this.promptReload('update.unrecoverable'));

    // Il service worker controlla gli aggiornamenti solo quando l'app viene
    // aperta da zero. Un'app installata sul telefono resta spesso in
    // background per giorni: si ricontrolla ogni volta che torna in primo piano.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.swUpdate.checkForUpdate().catch(() => undefined);
      }
    });
  }

  private async promptReload(messageKey: string) {
    if (this.prompting) return;
    this.prompting = true;

    const texts = await new Promise<Record<string, string>>((resolve) =>
      this.translate.get([messageKey, 'update.reload', 'update.later']).subscribe(resolve),
    );
    const toast = await this.toastCtrl.create({
      message: texts[messageKey],
      position: 'top',
      buttons: [
        { text: texts['update.later'], role: 'cancel' },
        { text: texts['update.reload'], role: 'reload' },
      ],
    });
    await toast.present();

    // Niente `handler` sui bottoni: girano fuori dalla zona di Angular (vedi
    // CLAUDE.md, pitfall degli alert). Si legge il ruolo alla chiusura.
    const { role } = await toast.onDidDismiss();
    this.prompting = false;
    if (role === 'reload') {
      document.location.reload();
    }
  }
}
