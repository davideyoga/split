# Test book — gruppi via link, niente amici, blocco, registrazione

Data: 2026-11-07, dopo il merge di `registration` in `dev`. Sostituisce il test book del 2026-10-25 (amici e richieste da accettare, funzionalità tolte). Copre le quattro fasi di [InvitiGruppo.md](InvitiGruppo.md):

- **A**: spese senza amici, cioè senza niente da accettare;
- **B**: link d'invito ai gruppi;
- **C**: "Blocca" ed "Esci dal gruppo";
- **D**: registrazione aperta, con il codice via email e con **Google**.

Il login con **Apple** non è coperto: per ora non si può provare, e il suo pulsante non compare se `appleClientId` è vuoto.

Le regole sono in `CLAUDE.md` (sezioni **Friends removed**, **Group invite links**, **Block and leave group**, **Registration**, **Google and Apple**) e in [Auth.md](Auth.md). I test automatici equivalenti stanno in `splitFront-e2e/src/` (`participant-search`, `invite`, `group`, `block`, `registration`, `login`, `notifications`). Google non è nei test automatici: servono token firmati da Google, quindi qui è il solo modo di provarlo.

**I casi vanno eseguiti in ordine:** ognuno parte dallo stato lasciato dai precedenti. Gli importi attesi valgono solo partendo da utenti senza dati, come quelli creati qui sotto.

## 0. Preparazione

1. Postgres acceso e migrazioni applicate:
   ```
   cd splitBack && set -a && . ../.env && set +a && npx prisma migrate status
   ```
   Deve dire che il database è aggiornato. Le ultime sono `20261107120000_remove_friends`, `20261107130000_add_group_invite`, `20261107140000_add_user_block` e `20261107180000_add_user_needs_name`. Se ne manca qualcuna, lancia `npx prisma migrate deploy && npx prisma generate` dalla stessa cartella.
2. In `.env`:
   ```
   MAIL_TRANSPORT=console          # il codice di login compare nel log di nx serve splitBack
   AUTH_SIGN_UP=open               # senza, la registrazione resta chiusa (default)
   GOOGLE_CLIENT_ID=<client ID>    # vedi il punto 3
   ```
3. **Google** (gratuito, istruzioni complete in [Auth.md](Auth.md), "Configurare Google"):
   - in Google Cloud Console serve un client OAuth di tipo *Web application*;
   - fra le *Authorized JavaScript origins* devono esserci `http://localhost` e `http://localhost:4200`;
   - nella schermata di consenso, in modalità *Testing*, aggiungi come utenti di test i **due account Google** che userai, chiamati qui **G1** e **G2**. Devono essere due account mai usati in Split;
   - copia lo stesso Client ID in `googleClientId` di `splitFront/src/environments/environment.ts`. È un dato pubblico, ma è tuo: non serve committarlo;
   - lascia vuoti `appleClientId` e `appleRedirectUri`.
4. Avvia (o **riavvia**: non è un watch server, e `.env` si legge all'avvio) le due app:
   ```
   npx nx serve splitBack
   npx nx serve splitFront      # http://localhost:4200
   ```
5. Crea quattro utenti nuovi, senza dati, così i saldi partono da zero. I nomi sono diversi da quelli del test book precedente, che potrebbero avere già delle spese.
   ```
   cat > /tmp/users.testbook.json <<'EOF'
   [
     { "email": "anna2@testbook.test",  "nickName": "Anna.T2" },
     { "email": "bruno2@testbook.test", "nickName": "Bruno.T2" },
     { "email": "carla2@testbook.test", "nickName": "Carla.T2" },
     { "email": "dario2@testbook.test", "nickName": "Dario.T2" }
   ]
   EOF
   set -a && . ./.env && set +a && node splitBack/prisma/add-users.mts /tmp/users.testbook.json
   ```
   Lo script è idempotente: rilanciarlo non crea doppioni. Le email `elena2@testbook.test` e `fabio2@testbook.test` invece **non** vanno create: servono alla registrazione (sezione 4).
6. **Un contesto browser per utente.** La sessione sta nel `localStorage`, quindi servono contesti separati, per esempio:
   - Chrome normale per Anna;
   - Chrome in incognito per Bruno;
   - Firefox normale per Carla;
   - Firefox privato per Dario.

   Due finestre in incognito dello stesso Chrome condividono la sessione: non bastano. Per Google (sezione 5) va bene il contesto di Dario dopo il logout, o un profilo Chrome a parte.
   - **All'inizio fanno login solo Anna e Bruno.**
   - Carla entra in G-03, passando dal link d'invito.
   - Dario entra prima della sezione 3.
7. Facoltativo: DevTools → modalità dispositivo (es. Pixel 7), perché l'app è pensata per il telefono. Lingua: italiano (Profilo → Lingua).

Abbreviazioni: **A** = Anna.T2, **B** = Bruno.T2, **C** = Carla.T2, **D** = Dario.T2. "Notifiche" = la campanella in alto a destra di Attività, Gruppi e Saldi. Dopo un'azione di un altro utente, per vedere il cambiamento tira giù la pagina per aggiornarla, oppure cambia tab e torna.

---

## 1. Spese e contatti, senza amici (P)

### P-01 · Una spesa con chi non condivide nulla conta subito
- **A**: Attività → **+** → importo `20`, descrizione `Pizza` → "Dividi con" → segmento **Persona** → scrivi `bruno.t2` → **Cerca** → tocca **Bruno.T2** → Salva.
- **Atteso, A:** in Attività c'è Pizza con la tua quota **10,00 €** e sotto, in verde, "hai prestato 10,00".
- **Atteso, B:** la campanella ha un numero. Nelle Notifiche c'è "Anna.T2 ti ha aggiunto a “Pizza” (20,00 €)". In Attività c'è Pizza con "devi 10,00", e nel tab Saldi "Devi a Anna.T2" 10,00 €. Non c'è niente da accettare.
- [ ] OK

### P-02 · Nessuna richiesta da accettare
- **B**: Notifiche → tocca la riga di Pizza.
- **Atteso:**
  - nelle Notifiche non c'è una sezione "Richieste";
  - il dettaglio di Pizza non ha un riquadro Accetta/Rifiuta;
  - in alto ci sono **matita** e **cestino**, perché B può modificarla.
- [ ] OK

### P-03 · I contatti nella scelta dei partecipanti
- **A**: Attività → **+** → "Dividi con" → **Persona**.
- **Atteso:**
  - sotto "PERSONE CON CUI DIVIDI LE SPESE" c'è **Bruno.T2**, e solo lui;
  - scrivendo `bru` la lista resta con Bruno, scrivendo `xyz` si svuota;
  - sotto c'è la nota "Per aggiungere qualcun altro scrivi il nickname esatto o l'email e tocca Cerca.".
- Chiudi la modale senza salvare la spesa.
- [ ] OK

### P-04 · Ricerca esatta, per nickname o email
- **A**: di nuovo **+** → "Dividi con" → **Persona**:
  1. scrivi `Carl` e tocca **Cerca**;
  2. scrivi ` CARLA2@testbook.test ` (con le maiuscole e gli spazi) e premi **Invio**.
- **Atteso:**
  1. "Nessun utente con questo nickname o email. Controlla che sia scritto esattamente.";
  2. compare **Carla.T2**: l'email non distingue le maiuscole e Invio vale come Cerca.
- Chiudi senza salvare.
- [ ] OK

### P-05 · Chi è già nella spesa viene avvisato delle modifiche
- **A**: apri Pizza → matita → importo `30` → Salva.
- **Atteso, B:** una notifica nuova, "Anna.T2 ha modificato “Pizza” (30,00 €)"; nel tab Saldi B deve **15,00 €** ad Anna.T2.
- [ ] OK

---

## 2. Gruppi e link d'invito (G)

### G-01 · Un gruppo nuovo chiede solo il nome
- **A**: tab Gruppi → **+**.
- **Atteso, nella modale:** c'è solo il nome, nessun "Aggiungi membro", e la nota "Creato il gruppo avrai un link per invitare gli altri.".
- Nome `Lisbona` → **Crea gruppo**.
- **Atteso:** toast "Gruppo creato". Si apre Lisbona direttamente sul segmento **Membri**: c'è solo Anna.T2 (tu) e, sotto, il riquadro "INVITA CON UN LINK".
- [ ] OK

### G-02 · Creare il link
- **A**: lascia "Scade dopo" su **7 giorni** → **Crea link**.
- **Atteso:**
  - compare il campo "Link d'invito" con `http://localhost:4200/join#` seguito da 43 caratteri;
  - sotto c'è "Manda questo link alle persone che vuoi nel gruppo. Funziona fino al" e la data di fra 7 giorni;
  - **Copia link** mostra il toast "Link copiato". Su un telefono c'è anche **Condividi**;
  - il bottone diventa **Nuovo link** e compare **Revoca link**.
- **Copia il link in un file di appunti** (link 1): serve nei prossimi casi.
- [ ] OK

### G-03 · Il link aperto senza login: anteprima
- **C** (non ha ancora fatto login): incolla il link 1 nella barra degli indirizzi.
- **Atteso:**
  - pagina "Invito a un gruppo" con "Anna.T2 ti invita in", **Lisbona** in grande, e "1 membro · link valido fino al …";
  - bottone **Accedi per entrare**, con la nota "Con la tua email: se non hai ancora un account, si crea adesso. Subito dopo tornerai qui.";
  - nella barra degli indirizzi resta solo `localhost:4200/join`, **senza** il token.
- [ ] OK

### G-04 · Login e ritorno al link
- **C**: **Accedi per entrare** → email `carla2@testbook.test` → Invia codice → codice preso dal log del backend → Accedi.
- **Atteso:** si torna sulla pagina dell'invito, non su Attività, con **Unisciti al gruppo**.
- Tocca **Unisciti al gruppo**.
- **Atteso, C:** toast "Ora fai parte di “Lisbona”", e si apre Lisbona.
- **Atteso, A:** notifica "Carla.T2 ora fa parte del gruppo “Lisbona”", che toccata apre il gruppo. Nel segmento Membri, dopo l'aggiornamento, c'è Carla.T2.
- [ ] OK

### G-05 · Riaprire il link: già membro
- **C**: incolla di nuovo il link 1.
- **Atteso:** "Sei già in questo gruppo." e **Apri il gruppo**, che porta a Lisbona. **A** non riceve una seconda notifica.
- [ ] OK

### G-06 · Il link si vede solo appena creato
- **A**: torna su Gruppi, riapri Lisbona → segmento **Membri**.
- **Atteso:**
  - non c'è più il campo con il link, ma "C'è un link attivo fino al … Per mandarlo di nuovo creane uno nuovo: il vecchio smette di funzionare.";
  - restano **Nuovo link** e **Revoca link**.
- [ ] OK

### G-07 · Un link nuovo revoca il vecchio
- **A**: "Scade dopo" → **1 giorno** → **Nuovo link**. Copia il nuovo link (link 2).
- **B**: apri il **link 1**.
- **Atteso, B:**
  - "Questo invito non funziona";
  - "Il link è stato revocato. Chiedine uno nuovo a chi te l'ha mandato.";
  - bottone **Vai a Split**.
- [ ] OK

### G-08 · Entrare con il link nuovo, già con la sessione
- **B**: apri il **link 2** → **Unisciti al gruppo**.
- **Atteso:** si apre Lisbona; nel segmento Membri ci sono Anna.T2, Carla.T2 e Bruno.T2. **A** e **C** ricevono "Bruno.T2 ora fa parte del gruppo “Lisbona”".
- [ ] OK

### G-09 · Revocare il link
- **A**: Lisbona → Membri → **Revoca link** → nella conferma "Revocare il link?" tocca **Revoca link**.
- **Atteso, A:** toast "Link revocato"; torna il bottone **Crea link**.
- **D** (non ha ancora fatto login): apri il **link 2**.
- **Atteso, D:** "Il link è stato revocato…". Chi era già entrato resta nel gruppo.
- [ ] OK

### G-10 · Link incompleto
- Qualsiasi utente: apri `http://localhost:4200/join#abc`.
- **Atteso:** "Il link è incompleto o non è mai stato valido. Chiedine uno nuovo a chi te l'ha mandato."
- [ ] OK

### G-11 · Nelle impostazioni del gruppo niente "Aggiungi membro"
- **A**: Lisbona → **⋮** (Impostazioni gruppo).
- **Atteso:** ci sono la rinomina, i membri con il cestino e, in fondo, **Esci dal gruppo**. Non c'è "Aggiungi membro".
- [ ] OK

### G-12 · Una spesa di gruppo con chi è entrato dal link
- **C**: Lisbona → **+** → importo `90`, descrizione `Albergo` → Salva.
- **Atteso, nella form:** il gruppo è già scelto ("Lisbona · 3").
- **Atteso, dopo il salvataggio:**
  - **A** e **B** ricevono "Carla.T2 ti ha aggiunto a “Albergo” (90,00 €)";
  - nel segmento Saldi di Lisbona, visto da C: "Anna.T2 ti deve" 30,00 € e "Bruno.T2 ti deve" 30,00 €.
- [ ] OK

---

## 3. Blocca ed Esci dal gruppo (B)

Prima di iniziare **D** fa login dalla pagina di login (`dario2@testbook.test`) e crea una spesa con C: **+** → `12`, `Taxi` → "Dividi con" → cerca `carla.t2` → Salva.

### B-01 · Bloccare dal dettaglio di una spesa
- **C**: Notifiche → "Dario.T2 ti ha aggiunto a “Taxi” (12,00 €)" → tocca la riga → nel dettaglio, sotto "PARTECIPANTI", tocca la riga di **Dario.T2**.
- **Atteso:**
  - si apre un menu con "Dario.T2", la spiegazione "Non potrà più aggiungerti a spese né trovarti con la ricerca. Le spese che avete già in comune restano.", **Blocca Dario.T2** in rosso e **Annulla**;
  - toccando invece la riga di Carla.T2 (te stessa) non succede niente.
- Tocca **Blocca Dario.T2**.
- **Atteso:** toast "Hai bloccato Dario.T2".
- [ ] OK

### B-02 · Chi è bloccato non ti trova più
- **D**: **+** → "Dividi con" → **Persona**.
- **Atteso:**
  - Carla.T2 non è fra "Persone con cui dividi le spese", anche se hanno Taxi in comune;
  - cercando `carla.t2` o `carla2@testbook.test` esce "Nessun utente con questo nickname o email…". Dario non può sapere di essere bloccato.
- Chiudi senza salvare.
- **C**: anche fra i contatti di Carla non c'è Dario.T2.
- [ ] OK

### B-03 · La spesa in comune resta, ma senza notifiche
- **D**: apri Taxi → matita → importo `16` → Salva.
- **Atteso:**
  - il salvataggio riesce, perché la spesa era già in comune;
  - **C** non riceve "ha modificato";
  - nel tab Saldi di C, verso Dario.T2, il debito è salito a 8,00 €.
- [ ] OK

### B-04 · Sbloccare dal Profilo
- **C**: Profilo → **Persone bloccate**.
- **Atteso:** c'è Dario.T2 con **Sblocca**.
- Tocca **Sblocca**.
- **Atteso:** toast "Hai sbloccato Dario.T2", poi "Non hai bloccato nessuno". **D** ritrova Carla.T2 cercando `carla.t2`.
- [ ] OK

### B-05 · Uscire da un gruppo
- **B**: Lisbona → **⋮** → **Esci dal gruppo**.
- **Atteso:** la conferma dice "Uscire da “Lisbona”?" e spiega che le spese in cui sei restano.
- Tocca **Esci dal gruppo**.
- **Atteso:**
  - toast "Non fai più parte del gruppo", si torna su Gruppi e Lisbona non c'è più;
  - in Attività di B c'è ancora Albergo, e nel tab Saldi resta il debito di 30,00 € verso Carla.T2;
  - nel segmento Membri di A non c'è più Bruno.T2.
- [ ] OK

---

## 4. Registrazione con il codice via email (R)

Si usa il contesto di **D**: Profilo → Esci.

### R-01 · Un'email nuova riceve il codice e crea l'account
- **Atteso, sulla pagina di login:** "Accedi o crea il tuo account: ti mandiamo un codice via email.". Non c'è il pulsante di Apple; quello di Google c'è se hai configurato `googleClientId`.
- Scrivi `elena2@testbook.test` → **Invia codice**.
- **Atteso:** "Abbiamo inviato un codice di 6 cifre a elena2@testbook.test. …"; nel log del backend c'è il codice.
- Inserisci il codice → Accedi.
- **Atteso:**
  - pagina "Il tuo nome" con "Come ti chiami?";
  - il campo Nickname è **vuoto**: il nome provvisorio `user` + 8 cifre non viene proposto;
  - **Continua** è disattivato finché il nome non è valido.
- [ ] OK

### R-02 · Senza nickname non si va altrove
- Nella barra degli indirizzi: `localhost:4200/tabs/groups`.
- **Atteso:** si torna su "Come ti chiami?". Nell'URL c'è `returnUrl=%2Ftabs%2Fgroups`.
- [ ] OK

### R-03 · Le regole del nickname
1. Scrivi `Ely` ed esci dal campo.
2. Scrivi `Anna.T2` → **Continua**.
3. Scrivi `Elena.T2` → **Continua**.
- **Atteso:**
  1. "Troppo corto: almeno 5 caratteri (ora 3)", e Continua resta disattivato;
  2. "Questo nickname è già usato";
  3. si arriva sul tab **Gruppi** (il returnUrl di R-02), vuoto.
- Nel Profilo c'è Elena.T2. Ricaricando la pagina non si torna su "Come ti chiami?".
- [ ] OK

### R-04 · "Usa un altro account"
- Profilo → Esci → login con `fabio2@testbook.test` → codice → Accedi.
- **Atteso:** "Come ti chiami?".
- Tocca **Usa un altro account**.
- **Atteso:** si torna al login, e la sessione è chiusa: riaprendo `localhost:4200/tabs/activity` si resta sul login.
- [ ] OK

### R-05 · Registrarsi passando da un link d'invito
- **A**: Lisbona → Membri → **Crea link** (7 giorni) → copia il link (link 3).
- Stesso contesto di R-04 (nessuna sessione): apri il link 3 → **Accedi per entrare** → `fabio2@testbook.test` → codice nuovo → Accedi.
- **Atteso:** "Come ti chiami?". Fabio ha già l'account, creato in R-04, ma non ha ancora scelto il nome.
- Scrivi `Fabio.T2` → **Continua**.
- **Atteso:**
  - si torna sull'anteprima di Lisbona, con **Unisciti al gruppo**;
  - dopo "Unisciti", Lisbona ha come membri Anna.T2, Carla.T2 e Fabio.T2;
  - **A** e **C** ricevono "Fabio.T2 ora fa parte del gruppo “Lisbona”".
- [ ] OK

---

## 5. Login e registrazione con Google (O)

Servono la preparazione del punto 3 e i due account Google **G1** e **G2**, mai usati in Split. Si usa un contesto senza sessione (Profilo → Esci). Il pulsante di Google lo disegna Google stesso, e il testo dipende dalla lingua dell'account ("Accedi con Google", "Continua con Google"…).

### O-01 · Registrazione con Google
- Login → pulsante di Google → scegli **G1**.
- **Atteso:**
  - nessun codice da inserire: si arriva su "Come ti chiami?";
  - il campo è già compilato con il nome del profilo Google ripulito (per esempio "Mario Rossi" → `Mario.Rossi`, "José Pérez" → `Jose.Perez`). Se il nome è troppo corto, ha caratteri di altri alfabeti o è già preso, il campo è vuoto.
- Tieni il nome proposto, o scrivine uno valido → **Continua**.
- **Atteso:** si arriva su Attività, vuota. Nel Profilo c'è il nickname scelto e l'email di G1.
- [ ] OK

### O-02 · Lo stesso account con il codice
- Profilo → Esci → login con il **codice**, scrivendo l'email di G1 → codice dal log → Accedi.
- **Atteso:** si entra direttamente su Attività, senza "Come ti chiami?", con lo stesso nickname di O-01. È lo stesso account, non un secondo.
- [ ] OK

### O-03 · Collegare Google a un account creato con il codice
- Profilo → Esci → login con il **codice**, scrivendo l'email di **G2** → codice → "Come ti chiami?" → `Gmail.T2` → Continua.
- Profilo → Esci → login → pulsante di Google → scegli **G2**.
- **Atteso:**
  - si entra direttamente, senza "Come ti chiami?";
  - nel Profilo il nickname resta **Gmail.T2**: il nome del profilo Google non lo sovrascrive. È lo stesso account creato col codice, a cui si è aggiunto Google.
- [ ] OK

### O-04 · Google passando da un link d'invito
- **A**: Lisbona → Membri → **Nuovo link** → copia il link (link 4).
- Contesto senza sessione: apri il link 4 → **Accedi per entrare** → pulsante di Google → **G1**.
- **Atteso:**
  - si torna sull'anteprima di Lisbona, perché G1 ha già scelto il nome in O-01;
  - "Unisciti al gruppo" porta in Lisbona, e A riceve "<nickname di G1> ora fa parte del gruppo “Lisbona”".
- [ ] OK

### O-05 · Registrazione chiusa (facoltativo)
- In `.env` togli `AUTH_SIGN_UP=open` (o mettici `closed`) e riavvia il backend.
- Login con il codice e un'email mai vista, per esempio `chiuso2@testbook.test`.
- **Atteso:** la stessa schermata "Abbiamo inviato un codice…", ma nel log non arriva nessun codice, e qualsiasi codice dà "Codice errato".
- Se hai un terzo account Google mai usato in Split: pulsante di Google con quell'account.
- **Atteso:** "Non esiste un account Split con questa email.". Chi ha già un account (G1, G2, Anna…) entra lo stesso.
- **Rimetti `AUTH_SIGN_UP=open` e riavvia il backend.**
- [ ] OK

---

## 6. Regressione (X)

### X-01 · Data della spesa dal calendario
- **A**: **+** → `5`, `Caffè` → riga "Data" → scegli un altro giorno del mese **dal calendario** → Fatto → Salva → apri la spesa.
- **Atteso:** nel dettaglio c'è il giorno scelto, non quello di un altro mese. Prima nei test automatici il calendario a volte scorreva al mese dopo.
- [ ] OK

### X-02 · Semplifica i debiti in un gruppo con membri entrati dal link
- **A**: Lisbona → segmento Saldi → **Semplifica i debiti**.
- **Atteso:** la modale si apre senza errori, con "Niente da semplificare" oppure con il piano. Se c'è un piano, **Applica** mostra "Debiti semplificati", e i saldi netti di ognuno non cambiano.
- [ ] OK

### X-03 · Rimborso dal tab Saldi
- **B**: tab Saldi → riga di Carla.T2 → **Salda** → conferma 30,00 €.
- **Atteso:** il debito verso Carla sparisce; **C** riceve la notifica del rimborso.
- [ ] OK

### X-04 · Inglese e tema scuro
- Profilo → Lingua → English, e il sistema in tema scuro.
- **Atteso:** sono tradotte e leggibili tutte le pagine nuove:
  - il login con il pulsante di Google;
  - "Your name" / "What should we call you?";
  - l'anteprima del link (apri un link qualsiasi, anche revocato);
  - "Invite with a link" nel segmento Members;
  - "Blocked people" nel Profilo;
  - il menu "Block …";
  - "Leave group".
- [ ] OK

---

## 7. Controlli via API (facoltativi, S)

Il token di sessione si legge in DevTools → Application → Local Storage → `split_auth` → `accessToken`. Nei comandi `$T` è quel token, e `$TOKEN` è il token di un link, cioè la parte dopo `#`.

### S-01 · L'anteprima è pubblica ma non dice chi c'è
```
curl -s -X POST localhost:3000/api/invite/preview -H 'Content-Type: application/json' -d "{\"token\":\"$TOKEN\"}"
```
- **Atteso:** solo `groupName`, `invitedBy`, `memberCount`, `expiresAt`, `alreadyMember` (false) e `groupPublicId` (null). Niente nomi dei membri, niente spese. Con un link revocato: `410` con `"code":"INVITE_REVOKED"`.
- [ ] OK

### S-02 · Senza sessione non si entra, e l'aggiunta di membri non esiste più
```
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/invite/join -H 'Content-Type: application/json' -d "{\"token\":\"$TOKEN\"}"
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/group/<publicId>/members -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"memberPublicIds":[]}'
```
- **Atteso:** `401`, poi `404`.
- [ ] OK

### S-03 · Il nome mandato al primo login non aggira le regole
```
curl -s -X POST localhost:3000/api/auth/email-otp/send-verification-otp -H 'Content-Type: application/json' -d '{"email":"gino2@testbook.test","type":"sign-in"}'
# codice dal log del backend
curl -s -X POST localhost:3000/api/auth/sign-in/email-otp -H 'Content-Type: application/json' -d '{"email":"gino2@testbook.test","otp":"<codice>","name":"..ad"}'
```
- **Atteso:** `user.name` è `user` seguito da 8 cifre e `user.needsName` è `true`. Rifacendolo con un'altra email nuova e `"name":"Zio Paperone!!"`, `user.name` è `Zio.Paperone`: un nome valido, ripulito, diventa solo la proposta di "Come ti chiami?".
- [ ] OK

### S-04 · Troppe ricerche
```
for i in $(seq 1 31); do curl -s -o /dev/null -w '%{http_code} ' "localhost:3000/api/user?q=nessuno$i@testbook.test" -H "Authorization: Bearer $T"; done; echo
```
- **Atteso:** 30 volte `200`, l'ultima `429`. Nell'app la ricerca di quell'utente mostra "Troppe ricerche: aspetta qualche minuto e riprova." fino allo scadere dell'ora. Il contatore è in memoria: un riavvio del backend lo azzera.
- [ ] OK

---

## Registro esiti

| ID | Esito | Note |
|---|---|---|
| P-01 … P-05 | | |
| G-01 … G-12 | | |
| B-01 … B-05 | | |
| R-01 … R-05 | | |
| O-01 … O-05 | | |
| X-01 … X-04 | | |
| S-01 … S-04 | | |

## Pulizia

Gli utenti di questo test book e i loro dati restano nel database di sviluppo: Elena.T2, Fabio.T2, gli account Google e quelli provvisori di S-03 compresi. Non c'è uno script per eliminarli. Per ripartire da zero, `npx prisma migrate reset --schema=splitBack/prisma/schema.prisma` svuota **tutto** il DB di sviluppo; dopo vanno rilanciati `seed.ts` e `add-users.mts` (vedi `CLAUDE.md`). Se hai messo il Client ID in `environment.ts`, toglilo prima di committare.
