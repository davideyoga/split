# Handoff: sistema di navigazione Split (v1)

Documento auto-sufficiente per Claude Code, da eseguire nel repo `davideyoga/split`, branch `dev`.
Tutto il lavoro descritto qui riguarda `splitFront` (Ionic 8 + Angular standalone), tranne il punto 8 (nessuna modifica backend richiesta).

## Overview

L'app oggi ha 5 rotte (`/login`, `/home`, `/add-expense`, `/groups`, `/groups/:publicId`) e un grafo a stella centrato su Home: solo `home.html` porta ai gruppi (icona *people* nell'header), e il FAB per creare una spesa esiste solo in Home. Risultato: la struttura non è mai visibile, l'azione più frequente (creare una spesa dentro un gruppo) costa ~6 tap, le spese in lista non sono tappabili e i saldi non hanno nessuna azione.

Questo handoff definisce un sistema di navigazione completo: **shell a tab persistente + creazione contestuale + dettagli navigabili**, con rotte, file da creare/modificare, chiavi i18n e criteri di accettazione.

## About the Design Files

I file in questo bundle sono **riferimenti di design in HTML** (`Split - Navigabilità.dc.html`): prototipi che mostrano aspetto e comportamento attesi, **non codice di produzione da copiare**. L'implementazione va fatta nell'ambiente esistente del repo — Ionic 8 + Angular standalone, componenti `@ionic/angular/standalone`, `ngx-translate`, form reattivi — riusando i pattern già presenti nei file citati.

Il prototipo contiene: le 6 schermate attuali ricostruite (`1a`–`1f`) e tre direzioni proposte (`2a` tab bar, `2b` gruppo come contesto, `2c` nuova spesa in modale). Il sistema descritto qui è la **fusione delle tre**.

## Fidelity

**Medio-alta.** L'app non ha tema custom (`src/theme/variables.scss` e `src/styles.scss` sono vuoti): tutto è **Ionic di default**. Quindi non ci sono valori di design da replicare a mano — si usano i componenti Ionic standard e le loro CSS variables. Non introdurre colori, ombre, radius o font custom: se un valore serve, deve venire da una CSS variable Ionic (`--ion-color-primary`, `--ion-color-medium`, `--ion-color-success`, `--ion-color-danger`, `--ion-text-color`).

---

## 1. Struttura di navigazione

Tre livelli, nessun altro:

```
Livello 0  /login                         (fuori dalla shell, nessuna tab)
Livello 1  /tabs/activity                 shell a tab (sempre visibile)
           /tabs/groups
           /tabs/balances
           /tabs/profile
Livello 2  /tabs/groups/:publicId         push dentro la tab (tab bar resta visibile)
           /tabs/groups/:publicId/settings
           /tabs/activity/expense/:id
Modali     nuova/modifica spesa, selezione partecipante, salda debito
```

Regole:

- **La tab bar è sempre visibile** nei livelli 1 e 2. Non nasconderla nei dettagli.
- **Le modali sono per la creazione/modifica**, non per la navigazione. Chiudono con Annulla/Salva nell'header.
- **Ogni pagina di livello 2 è deep-linkabile** e ha un `ion-back-button` con `defaultHref` che punta al suo genitore reale nella gerarchia sopra (non a una pagina "plausibile").

### Le quattro tab

| Tab | Rotta | Icona (ionicons) | Label i18n | Contenuto |
| --- | --- | --- | --- | --- |
| Attività | `/tabs/activity` | `receipt-outline` | `tabs.activity` | Card saldo netto + lista spese recenti (tutte, personali e di gruppo) |
| Gruppi | `/tabs/groups` | `people-outline` | `tabs.groups` | Lista gruppi + FAB "nuovo gruppo" |
| Saldi | `/tabs/balances` | `swap-horizontal-outline` | `tabs.balances` | `app-expense-balances` a piena pagina + azione "Salda" per riga |
| Profilo | `/tabs/profile` | `person-circle-outline` | `tabs.profile` | Utente corrente, lingua, logout |

---

## 2. File da creare / modificare

### Creare

| File | Cosa |
| --- | --- |
| `src/app/pages/tabs/tabs.page.html` / `.ts` | Shell: `<ion-tabs>` + `<ion-tab-bar slot="bottom">` con 4 `ion-tab-button`. Standalone, importa `IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel`, `TranslatePipe`, `addIcons` per le 4 icone. |
| `src/app/pages/activity/activity.page.html` / `.ts` / `.scss` | Ex `home`, senza card Gruppi e senza icone header. Header: titolo `tabs.activity` + `ion-buttons slot="end"` con ricerca (opzionale, fase 3). Card saldo netto con CTA `balances.settle-up` → `/tabs/balances`. Lista spese con item tappabili. `ion-refresher` in cima. FAB → modale nuova spesa. |
| `src/app/pages/balances/balances.page.html` / `.ts` | Usa `app-expense-balances` esistente + per ogni riga un `ion-button fill="clear"` `balances.settle-up` che apre la modale di rimborso (fase 3; in fase 1 il bottone può essere presente e disabilitato solo se il backend non supporta il settlement — **non nasconderlo**). |
| `src/app/pages/profile/profile.page.html` / `.ts` | `ion-list`: item con nickname + email dell'utente corrente (`AuthService.currentUser()`); `ion-item` con `ion-select` lingua (it/en); `ion-item button` "Esci" `color="danger"` con `AlertController` di conferma. |
| `src/app/pages/expense-detail/expense-detail.page.html` / `.ts` | Dettaglio spesa: descrizione, importo, categoria (chip), pagante, data, lista contributori con la propria `share`. Header con back a `/tabs/activity` e `ion-buttons slot="end"` con modifica/elimina (elimina: `AlertController` di conferma). |
| `src/app/pages/expense-form/expense-form.modal.html` / `.ts` | La nuova spesa come **modale** (vedi §4), presentata via `ModalController`. Sostituisce la pagina `add-expense`. |
| `src/app/pages/groups/group-settings/group-settings.page.html` / `.ts` | Rinomina gruppo + gestione membri, spostati fuori dal dettaglio. |
| `src/app/services/language.service.ts` | Legge/scrive la lingua in `localStorage` (chiave `split.lang`), fallback `navigator.language` → `it` se inizia per `it`, altrimenti `en`; espone `set(lang)` che chiama `TranslateService.use()`. |

### Modificare

| File | Cosa |
| --- | --- |
| `src/app/app.routes.ts` | Riscritto secondo §3. |
| `src/app/app.component.ts` | Rimuovere `translate.use('en')` hardcoded: la lingua la decide `LanguageService` (`it.json` esiste già ed è completo, oggi è irraggiungibile). |
| `src/app/services/auth.interceptor.ts` | Gestire il 401 (§8) — risolve il TODO già tracciato in `TODO.md`. |
| `src/app/pages/groups/group-list/group-list.html` / `.ts` | Togliere il back button (ora è una tab root). Il form "Nuovo gruppo" esce dalla card sempre aperta e diventa una modale aperta da un FAB. La lista dei gruppi è il contenuto primario. Aggiungere `ion-refresher`. |
| `src/app/pages/groups/group-detail/group-detail.html` / `.ts` | Diventa un contenitore a `ion-segment` (Spese / Saldi / Membri) con titolo = nome del gruppo. Rinomina e rimozione membri vanno in `group-settings` (⋮ nell'header). Aggiungere FAB → modale nuova spesa **con il gruppo precompilato**. `defaultHref="/tabs/groups"`. |
| `src/app/components/group-expenses/group-expenses.component.html` | Gli `ion-item` diventano `button` + `routerLink` verso il dettaglio spesa. |
| `src/app/components/expense-balances/expense-balances.component.html` | Aggiungere un input `showSettleAction` (default `false`) che, se attivo, mostra il bottone "Salda" per riga. |
| `src/assets/i18n/it.json`, `en.json` | Chiavi nuove in §7. |
| `src/app/pages/home/*`, `src/app/pages/add-expense/*` | Rimossi dopo la migrazione (i contenuti si spostano in `activity` e `expense-form`). |

---

## 3. `app.routes.ts` (target)

```ts
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(m => m.Login),
  },
  {
    path: 'tabs',
    loadComponent: () => import('./pages/tabs/tabs.page').then(m => m.TabsPage),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'activity', pathMatch: 'full' },
      {
        path: 'activity',
        loadComponent: () => import('./pages/activity/activity.page').then(m => m.ActivityPage),
      },
      {
        path: 'activity/expense/:id',
        loadComponent: () => import('./pages/expense-detail/expense-detail.page').then(m => m.ExpenseDetailPage),
      },
      {
        path: 'groups',
        loadComponent: () => import('./pages/groups/group-list/group-list').then(m => m.GroupList),
      },
      {
        path: 'groups/:publicId',
        loadComponent: () => import('./pages/groups/group-detail/group-detail').then(m => m.GroupDetail),
      },
      {
        path: 'groups/:publicId/settings',
        loadComponent: () => import('./pages/groups/group-settings/group-settings.page').then(m => m.GroupSettingsPage),
      },
      {
        path: 'balances',
        loadComponent: () => import('./pages/balances/balances.page').then(m => m.BalancesPage),
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.page').then(m => m.ProfilePage),
      },
    ],
  },
  // Compatibilità con i vecchi link/deep link
  { path: 'home', redirectTo: 'tabs/activity', pathMatch: 'full' },
  { path: 'groups', redirectTo: 'tabs/groups', pathMatch: 'full' },
  { path: 'groups/:publicId', redirectTo: 'tabs/groups/:publicId', pathMatch: 'full' },
  { path: 'add-expense', redirectTo: 'tabs/activity', pathMatch: 'full' },
  { path: '', redirectTo: 'tabs/activity', pathMatch: 'full' },
  { path: '**', redirectTo: 'tabs/activity' },
];
```

Note:
- `authGuard` va sul nodo `tabs`, non su ogni figlio (oggi è ripetuto su ogni rotta).
- Aggiornare tutte le `navigateByUrl('/home')` esistenti (`login.ts`, `add-expense.ts`) in `'/tabs/activity'`.
- `PreloadAllModules` in `main.ts` resta com'è.

---

## 4. Creazione contestuale della spesa (il fix che vale più di tutti)

Oggi: FAB solo in Home → pagina `add-expense` → modale `select-participant` → segmento *Gruppo* → scelta gruppo. Dal dettaglio gruppo sono ~6 tap e il gruppo va riselezionato a mano.

Target: **modale unica, pre-contestualizzata dal punto di partenza.**

```ts
// api del modale
interface ExpenseFormProps {
  group?: Group;        // precompilato se aperto dal dettaglio gruppo
  participants?: User[]; // precompilati se aperti da un contesto con persone
  expense?: ExpenseListItem; // presente = modalità modifica
}
```

- Aperta via `ModalController.create({ component: ExpenseFormModal, componentProps: { group } })`.
- Punti d'ingresso: FAB in `activity` (nessun contesto), FAB in `group-detail` (gruppo precompilato → **1 tap**), azione "Aggiungi spesa" nel dettaglio spesa non serve.
- Header della modale: `ion-buttons slot="start"` con `close` (Annulla) + `ion-title` + `ion-buttons slot="end"` con `ion-button strong="true"` Salva `[disabled]="form.invalid"`.
- **Elimina `<ion-footer>` dentro `<ion-content>`** (bug attuale di `add-expense.html`) e **non rendere i chip di selezione dopo il footer**: le scelte stanno sopra la piega come righe `ion-item button detail` con il valore corrente in `ion-note slot="end"`:
  - `expense-form.split-with` → "Viaggio del weekend · 4" (apre `select-participant`)
  - `expense-form.paid-by` → "Davide (tu)" (predisposto per il TODO su pagante selezionabile)
  - `expense-form.split-mode` → "Equa · 12.00 a testa" (predisposto per il TODO sulle quote diseguali)
- Importo come campo grande in cima (`ion-input` con `class="amount-input"`, font-size 40px, tutto il resto Ionic default); mantenere `sanitizeAmountInput()` e i validatori esistenti di `add-expense.ts`.
- Le chip categoria restano come sono oggi (già buone), inclusa la chip "Nuova".
- Al salvataggio: `dismiss({ created: true })`, la pagina chiamante ricarica la sua lista e mostra un `ToastController` con `expense-form.created` (oggi non c'è nessun feedback).

---

## 5. Comportamento per pagina

**Attività** — `ion-refresher` in cima (`loadExpenses()` + `loadGroups()`); item spesa `button` + `routerLink` a `/tabs/activity/expense/:id`; empty state con testo `activity.empty` **e** un `ion-button` "Aggiungi la prima spesa" che apre la modale (oggi è solo un `<p>`); card saldo netto con `balances.settle-up` → tab Saldi.

**Gruppi** — lista come contenuto primario; FAB `add` apre la modale "Nuovo gruppo" (nome + membri, riusa `select-participant`); empty state con CTA "Crea il primo gruppo"; `ion-refresher`.

**Dettaglio gruppo** — titolo = `group.name` (oggi è il generico "Gruppo"); `ion-segment` Spese/Saldi/Membri nel secondo `ion-toolbar` dell'header; ⋮ → `/tabs/groups/:publicId/settings`; FAB → modale nuova spesa con `group` precompilato; `defaultHref="/tabs/groups"`.

**Saldi** — `app-expense-balances` con `showSettleAction`; se vuoto, `balances.none` + rimando all'aggiunta di una spesa.

**Profilo** — nickname + email; `ion-select` lingua (it/en) che chiama `LanguageService.set()`; "Esci" `color="danger"` con conferma `AlertController` (`profile.logout-confirm`), poi `authService.logout()` + `navigateByUrl('/login')`.

**Login** — invariato, tranne il redirect a `/tabs/activity` e il supporto a `returnUrl` (§8).

---

## 6. Regole trasversali (valgono per ogni pagina nuova)

1. Ogni azione che muta dati termina con un `ion-toast` (successo) o un messaggio inline `ion-text color="danger"` (errore), come già fa `group-detail.ts` con `presentToast`.
2. Ogni lista ha `ion-refresher` + `ion-refresher-content`.
3. Ogni empty state ha un titolo, una frase e **un bottone** che porta all'azione corrispondente.
4. Ogni azione distruttiva (logout, elimina spesa, rimuovi membro) passa da `AlertController` con conferma.
5. Nessuna icona senza etichetta nell'header per azioni non ovvie (oggi *people* e *log-out* sono due icone nude affiancate).
6. Nessun colore, radius, ombra o font custom: solo componenti e CSS variables Ionic.
7. Tap target minimo 44px: non ridurre le altezze di default di `ion-item` / `ion-button`.

---

## 7. Chiavi i18n da aggiungere

Aggiungere in `src/assets/i18n/it.json` e `en.json` (di seguito i valori italiani; per `en.json` la traduzione equivalente).

```json
{
  "tabs": {
    "activity": "Attività",
    "groups": "Gruppi",
    "balances": "Saldi",
    "profile": "Profilo"
  },
  "activity": {
    "title": "Attività",
    "empty": "Nessuna spesa presente",
    "empty-cta": "Aggiungi la prima spesa",
    "recent": "Spese recenti"
  },
  "expense-form": {
    "title-new": "Nuova spesa",
    "title-edit": "Modifica spesa",
    "cancel": "Annulla",
    "save": "Salva",
    "split-with": "Dividi con",
    "paid-by": "Pagata da",
    "split-mode": "Divisione",
    "split-equal": "Equa",
    "split-each": "{{amount}} a testa",
    "created": "Spesa aggiunta",
    "updated": "Spesa aggiornata",
    "deleted": "Spesa eliminata",
    "delete-confirm": "Eliminare questa spesa?"
  },
  "expense-detail": {
    "title": "Spesa",
    "participants": "Partecipanti",
    "share": "Quota",
    "edit": "Modifica",
    "delete": "Elimina"
  },
  "balances": {
    "settle-up": "Salda",
    "settle-title": "Salda con {{name}}",
    "settled": "Saldo registrato"
  },
  "groups": {
    "settings": "Impostazioni gruppo",
    "segment-expenses": "Spese",
    "segment-balances": "Saldi",
    "segment-members": "Membri",
    "empty-cta": "Crea il primo gruppo",
    "remove-member-confirm": "Rimuovere {{name}} dal gruppo?"
  },
  "profile": {
    "title": "Profilo",
    "language": "Lingua",
    "logout": "Esci",
    "logout-confirm": "Vuoi uscire da Split?",
    "cancel": "Annulla"
  },
  "session": {
    "expired": "Sessione scaduta, accedi di nuovo"
  }
}
```

---

## 8. Sessione scaduta (401)

Oggi il 401 non è gestito: i service fanno `catchError → of([])`, quindi l'utente resta su Home a guardare liste vuote senza capire perché. In `auth.interceptor.ts`:

```ts
return next(req).pipe(
  catchError((err: HttpErrorResponse) => {
    if (err.status === 401) {
      authService.logout();
      router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      // toast: 'session.expired'
    }
    return throwError(() => err);
  }),
);
```

In `login.ts`, dopo il login riuscito, navigare a `returnUrl` se presente, altrimenti a `/tabs/activity`.

---

## 9. Criteri di accettazione

- [ ] Da qualunque pagina di livello 1 o 2 raggiungo Gruppi, Saldi e Profilo in **1 tap** (tab bar sempre visibile).
- [ ] Dal dettaglio di un gruppo creo una spesa in **1 tap** (FAB) e il gruppo risulta **già selezionato** nella modale.
- [ ] Ogni riga di spesa (in Attività e nel gruppo) è tappabile e apre il dettaglio spesa.
- [ ] `/tabs/groups/:publicId` aperta come deep link mostra il back verso `/tabs/groups`, e da lì la tab bar è visibile.
- [ ] I vecchi URL `/home`, `/groups`, `/groups/:id`, `/add-expense` continuano a funzionare via redirect.
- [ ] Il logout è solo nel Profilo, con conferma. Nessuna icona di logout negli header.
- [ ] La lingua è cambiabile dal Profilo e persiste al riavvio; nessun `translate.use('en')` hardcoded.
- [ ] Con token scaduto, la prima chiamata 401 porta a `/login` con il messaggio `session.expired` (non a una lista vuota).
- [ ] Ogni lista si aggiorna con pull-to-refresh; ogni azione mutante mostra un toast.
- [ ] Nessun valore di stile custom introdotto: solo componenti Ionic e CSS variables.
- [ ] `npx nx lint splitFront` e `npx nx test splitFront` passano; aggiornato `app.component.spec.ts` se rompe.

---

## 10. Ordine di implementazione consigliato

1. **Shell + rotte** — `tabs.page`, nuovo `app.routes.ts`, redirect di compatibilità, `home` → `activity` (spostamento, senza redesign). Verifica: la tab bar compare e naviga.
2. **Creazione contestuale** — `expense-form.modal`, FAB in Attività e nel gruppo, `group` precompilato, toast di conferma, rimozione della pagina `add-expense`.
3. **Dettagli e vicoli ciechi** — `expense-detail`, item tappabili, `group-detail` a segmenti + `group-settings`.
4. **Profilo e sessione** — `profile.page`, `LanguageService`, conferma logout, 401 nell'interceptor.
5. **Rifiniture** — `ion-refresher`, empty state con CTA, tab Saldi con azione "Salda" (che dipende dal `Settlement` lato backend già tracciato in `TODO.md` come priorità alta: se non c'è ancora, il bottone apre un messaggio "in arrivo" e non va rimosso dal design).

Aggiornare `TODO.md` alla fine: i TODO su `auth.interceptor.ts` (401) e sul footer di `add-expense.html` vengono chiusi da questo lavoro.

## Files

- `Split - Navigabilità.dc.html` — prototipo di riferimento: schermate attuali `1a`–`1f`, proposte `2a`/`2b`/`2c`. Si apre in un browser.
- `README.md` — questo documento.

## Assets

Nessun asset nuovo. Tutte le icone sono ionicons già disponibili: `receipt-outline`, `people-outline`, `swap-horizontal-outline`, `person-circle-outline`, `search-outline`, `ellipsis-vertical`, `close`, `add`, `card-outline`, `pie-chart-outline`, più quelle delle categorie già registrate in `models/category.model.ts`.
