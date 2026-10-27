# Test book — ricerca utenti, notifiche, amici

Data: 2026-10-25. Copre le funzionalità introdotte quel giorno: ricerca utenti esatta, notifiche con campanella, amici con spese e inviti ai gruppi in attesa. Le regole sono descritte in `CLAUDE.md` (sezioni **User search**, **Notifications**, **Friends**); i test automatici equivalenti sono in `splitFront-e2e/src/` (`participant-search`, `notifications`, `friends`).

**I test vanno eseguiti in ordine:** ognuno parte dallo stato lasciato dai precedenti (amicizie, spese, gruppi). Gli importi attesi valgono solo partendo da utenti senza dati, come quelli creati qui sotto.

## 0. Preparazione

1. Postgres acceso e migrazioni applicate:
   ```
   cd splitBack && set -a && . ../.env && set +a && npx prisma migrate status
   ```
   Deve dire che il database è aggiornato (ultime: `20261025120000_add_notification`, `20261025180000_add_friends`).
2. In `.env`: `MAIL_TRANSPORT=console`. Il codice di login compare nel log di `nx serve splitBack`.
3. Avvia (o **riavvia**, non è un watch server) le due app:
   ```
   npx nx serve splitBack
   npx nx serve splitFront      # http://localhost:4200
   ```
4. Crea quattro utenti dedicati, senza dati, così i saldi partono da zero:
   ```
   cat > /tmp/users.testbook.json <<'EOF'
   [
     { "email": "anna@testbook.test",  "nickName": "Anna.TB" },
     { "email": "bruno@testbook.test", "nickName": "Bruno.TB" },
     { "email": "carla@testbook.test", "nickName": "Carla.TB" },
     { "email": "dario@testbook.test", "nickName": "Dario.TB" }
   ]
   EOF
   set -a && . ./.env && set +a && node splitBack/prisma/add-users.mts /tmp/users.testbook.json
   ```
   Lo script è idempotente: rilanciarlo non crea doppioni.
5. **Una sessione per utente.** La sessione sta nel `localStorage` del browser, quindi servono quattro contesti separati, per esempio Chrome normale (Anna), Chrome in incognito (Bruno), Firefox normale (Carla), Firefox privato (Dario). Due finestre in incognito dello stesso Chrome condividono la sessione: non bastano.
6. Facoltativo: DevTools → modalità dispositivo (es. Pixel 7), l'app è pensata per il telefono. Lingua: italiano (Profilo → Lingua).

Abbreviazioni: **A** = Anna.TB, **B** = Bruno.TB, **C** = Carla.TB, **D** = Dario.TB. "Notifiche" = la campanella in alto a destra di Attività, Gruppi e Saldi.

---

## 1. Ricerca utenti (R)

Tutti da **A**: Attività → **+** → "Dividi con" → segmento **Persona**. Nessuna spesa viene salvata in questa sezione.

### R-01 · Nickname esatto, senza maiuscole
- Scrivi `bruno.tb` e tocca **Cerca**.
- **Atteso:** compare **Bruno.TB** sotto l'intestazione "NON SIETE ANCORA AMICI: DOVRÀ ACCETTARE".
- [ ] OK

### R-02 · Una parte del nome non basta
- Scrivi `Brun` e tocca **Cerca**.
- **Atteso:** "Nessun utente con questo nickname o email. Controlla che sia scritto esattamente."
- [ ] OK

### R-03 · Ricerca per email
- Scrivi ` BRUNO@testbook.test ` (maiuscole e spazi compresi) e premi **Invio** sulla tastiera.
- **Atteso:** compare Bruno.TB. Invio vale come Cerca.
- [ ] OK

### R-04 · Se stessi no
- Cerca `Anna.TB`, poi `anna@testbook.test`.
- **Atteso:** in entrambi i casi "Nessun utente…".
- [ ] OK

### R-05 · Niente ricerca mentre si scrive
- Svuota il campo: **Cerca** è disabilitato.
- Scrivi lentamente `Bruno.TB` senza premere Cerca.
- **Atteso:** nessun risultato e nessun "Nessun utente" finché non premi Cerca. Dopo una ricerca senza risultati, se modifichi il testo il messaggio sparisce.
- [ ] OK

### R-06 · Errore di rete distinto da "nessun utente"
- Ferma `nx serve splitBack`, cerca `Bruno.TB`.
- **Atteso:** "Ricerca non riuscita. Controlla la connessione e riprova." (non "Nessun utente"). Riavvia il backend prima di proseguire.
- [ ] OK

---

## 2. Spese con chi non è amico (A)

### A-01 · Spesa con un non amico: per chi la crea conta subito
- **A**: nuova spesa **30 €**, descrizione `Pizza`, Dividi con → cerca `Bruno.TB` → toccalo. Pagata da: Anna. Salva.
- **Atteso, nella form prima di salvare:** sotto il chip "Bruno.TB" la nota "Non ancora amici: Bruno.TB. Per loro la spesa conterà solo quando l'avranno accettata."
- **Atteso, A dopo il salvataggio:**
  - Pizza è in lista;
  - riquadro **Saldo +15,00 €**, e nella tab Saldi "Bruno.TB ti deve 15,00 €";
  - riquadro **Speso a <mese>: 15,00 €**;
  - nel dettaglio, sotto Bruno.TB, la riga "Deve ancora accettare".
- [ ] OK

### A-02 · Per l'altro non conta finché non accetta
- **B**: apri Attività.
- **Atteso:**
  - riquadro "1 spesa da accettare – Non contano per te finché non le accetti";
  - Pizza **non** è in lista;
  - Saldo 0,00 €, Speso 0,00 €, e nella tab Saldi nessuna riga con Anna;
  - la campanella ha un numero, e tra le Notifiche c'è "Anna.TB ti ha aggiunto a “Pizza” (30,00 €): accettala o rifiutala".
- [ ] OK

### A-03 · Chi deve accettare può solo accettare o rifiutare
- **B**: tocca quella notifica.
- **Atteso:** si apre il dettaglio di Pizza con un riquadro in alto ("Anna.TB ti ha aggiunto a questa spesa, ma non siete ancora amici…") e i bottoni **Accetta** / **Rifiuta**. In alto **non** ci sono matita e cestino.
- [ ] OK

### A-04 · Più spese della stessa persona = una richiesta
- **A**: nuova spesa **20 €** `Cinema` con Bruno.TB (cercalo di nuovo: non siete amici).
- **B**: Attività → "2 spese da accettare" → tocca il riquadro.
- **Atteso:** si aprono le Notifiche, con la sezione **RICHIESTE** in cima. C'è una sola scheda "Anna.TB vuole dividere spese con te", che elenca:
  - Cinema · "La tua quota 10,00 € di 20,00 €";
  - Pizza · "La tua quota 15,00 € di 30,00 €";
  - sotto, il bottone **Accetta Anna.TB**.
- [ ] OK

### A-05 · Rifiutare una spesa: la quota passa a chi l'ha aggiunta
- **B**: nella scheda tocca la ✕ rossa di **Cinema** → conferma "Rifiutare “Cinema”? Uscirai dalla spesa e la tua quota passerà a Anna.TB." → **Rifiuta**.
- **Atteso, B:** toast "Spesa rifiutata"; la scheda resta, ma con la sola Pizza.
- **Atteso, A:**
  - il dettaglio di Cinema ha un solo partecipante: Anna 20,00 €;
  - il Saldo torna a **+15,00 €**;
  - lo Speso sale a **35,00 €** (15 di Pizza + 20 di Cinema);
  - Notifiche: "Bruno.TB ha rifiutato “Cinema”: la sua quota ora è tua".
- [ ] OK

### A-06 · Accettare la persona: amici, e tutte le sue spese contano
- **B**: tocca **Accetta Anna.TB**.
- **Atteso, B:**
  - toast "Accettata: ora siete amici", e la sezione Richieste sparisce;
  - tornando indietro ad Attività, **subito e senza trascinare per aggiornare**: Pizza è in lista e il riquadro "da accettare" non c'è più;
  - Saldo **−15,00 €** ("Devi a Anna.TB 15,00 €"), Speso **15,00 €**.
- **Atteso, A:** Notifiche: "Bruno.TB ha accettato: ora siete amici".
- [ ] OK

### A-07 · Fra amici si entra subito
- **A**: nuova spesa **10 €** `Gelato` → Dividi con.
- **Atteso, nella modale:** Bruno.TB è già elencato sotto "I TUOI AMICI", senza cercarlo, e scrivendo `bru` la lista si filtra. Scelto Bruno, nella form non c'è la nota "Non ancora amici".
- Salva.
- **Atteso, B:** Gelato è subito in lista; Saldo −20,00 €; notifica "Anna.TB ti ha aggiunto a “Gelato” (10,00 €)" (senza "accettala o rifiutala").
- [ ] OK

### A-08 · Rifiuto dal dettaglio, quando chi rifiuta era il pagante
- **A**: nuova spesa **12 €** `Taxi` con Carla.TB (cercala), **Pagata da: Carla.TB**. Salva.
- **Atteso, A:** Saldo +14,00 € (Bruno deve 20, Anna deve 6 a Carla).
- **C**: Notifiche → tocca "Anna.TB ti ha aggiunto a “Taxi”…" → nel dettaglio **Rifiuta** → conferma.
- **Atteso, C:** toast "Spesa rifiutata", torna indietro; Taxi non è più visibile.
- **Atteso, A:** dettaglio di Taxi con "Pagata da Anna" e un solo partecipante, Anna 12,00 €; Saldo +20,00 €.
- [ ] OK

### A-09 · Accettare dal dettaglio
- **A**: nuova spesa **8 €** `Libro` con Carla.TB.
- **C**: apri Libro dalla notifica → **Accetta**.
- **Atteso, C:** toast "Accettata: ora siete amici"; il riquadro sparisce e compaiono **matita e cestino**; Saldo −4,00 €.
- [ ] OK

### A-10 · Una modifica che aggiunge un non amico
- **A**: apri Gelato → matita → Dividi con → cerca e aggiungi `Dario.TB`.
- **Atteso, nella form:** compare la nota "Non ancora amici: Dario.TB…". La divisione diventa equa su 3. Salva.
- **Atteso:**
  - **B**: "Anna.TB ha modificato “Gelato” (10,00 €)" (la sua quota è cambiata);
  - **D**: Attività con "1 spesa da accettare";
  - **A**: in Saldi c'è "Dario.TB ti deve 3,33 €" (per chi crea conta subito).
- [ ] OK

### A-11 · Si deve essere amici di chi ti aggiunge, non del creatore
- **B** (che è nella spesa ed è amico di Anna, non di Carla): apri Pizza → matita → aggiungi `Carla.TB` (cercala) → Salva. La divisione diventa 10 € a testa.
- **Atteso, C:** in Richieste una scheda "**Bruno.TB** vuole dividere spese con te" (Bruno, non Anna, anche se Carla è amica di Anna) con Pizza.
- **C**: rifiuta Pizza (✕ → Rifiuta).
- **Atteso:**
  - la quota di Carla va a **Bruno**, che l'aveva aggiunta: nel dettaglio di Pizza, Anna 10,00 € e Bruno 20,00 €;
  - **B** riceve "Carla.TB ha rifiutato “Pizza”: la sua quota ora è tua";
  - in Saldi di **A**: "Bruno.TB ti deve" 23,33 € (20 di Pizza + 3,33 di Gelato).
- [ ] OK

---

## 3. Gruppi e inviti (G)

### G-01 · Gruppo con un amico e un non amico
- **A**: Gruppi → **+** → nome `Vacanze` → Aggiungi membro Bruno.TB (dalla lista amici) e Dario.TB (cercato) → Crea.
- **Atteso, A:** nel gruppo, segmento Membri:
  - Anna.TB (tu) e Bruno.TB;
  - Dario.TB in grigio con "Invito in attesa di risposta".
- **Atteso, B:** il gruppo è subito nella tab Gruppi, con la notifica "Anna.TB ti ha aggiunto al gruppo “Vacanze”".
- [ ] OK

### G-02 · Chi è invitato non vede il gruppo
- **D**: tab Gruppi.
- **Atteso:**
  - Vacanze non c'è; in cima il riquadro "1 invito a un gruppo – Accettali o rifiutali dalle notifiche";
  - toccandolo, in Richieste ci sono la scheda "Anna.TB ti ha invitato nel gruppo “Vacanze”" (sottotitolo "Entrando, tu e i suoi 2 membri diventate amici", bottoni Accetta / Rifiuta) e la scheda per Gelato (da A-10).
- [ ] OK

### G-03 · Le spese del gruppo non includono gli invitati
- **A**: dentro Vacanze, **+** → `Albergo` **60 €** → Salva.
- **Atteso:** la riga "Dividi con" mostra "Vacanze · 2"; nel dettaglio ci sono solo Anna 30,00 € e Bruno 30,00 €, senza Dario.
- [ ] OK

### G-04 · Rifiutare un invito
- **B**: crea il gruppo `Bocce` con Dario.TB (Bruno e Dario non sono amici).
- **D**: Notifiche → scheda "Bruno.TB ti ha invitato nel gruppo “Bocce”" → **Rifiuta** → conferma ("Non entrerai in “Bocce”…").
- **Atteso:**
  - **D**: toast "Invito rifiutato", la scheda sparisce;
  - **B**: notifica "Dario.TB ha rifiutato l'invito in “Bocce”"; in Bocce → Membri c'è solo Bruno, senza invitati.
- [ ] OK

### G-05 · Accettare un invito: membro, e amico di tutti i membri
- **D**: Notifiche → scheda Vacanze → **Accetta**.
- **Atteso, D:**
  - toast "Ora fai parte del gruppo", e Vacanze compare nella tab Gruppi;
  - anche la scheda di Gelato **sparisce**, perché ora Dario è amico di Anna, e Gelato è in Attività (Saldo −3,33 €);
  - in Nuova spesa → Dividi con, sotto "I TUOI AMICI" ci sono Anna.TB e **Bruno.TB**, che pure non l'aveva invitato.
- **Atteso, A:** notifica "Dario.TB ora fa parte del gruppo “Vacanze”".
- **Nota:** Albergo (G-03) resta divisa fra Anna e Bruno finché qualcuno non la modifica. È il comportamento noto: alla modifica successiva il gruppo viene ri-espanso con i membri attuali.
- [ ] OK

### G-06 · Aggiungere membri dalle impostazioni
- **A**: Vacanze → Membri → Impostazioni gruppo → Aggiungi membro → Carla.TB (amica dal test A-09).
- **Atteso:** toast "Membro aggiunto", e Carla è subito fra i membri.
- **B**: Bocce → Impostazioni gruppo → Aggiungi membro → cerca `Carla.TB` (non è sua amica).
- **Atteso:** toast "Invito inviato: entrerà quando avrà accettato"; Carla compare con "Invito in attesa di risposta".
- [ ] OK

### G-07 · Annullare un invito
- **B**: in Impostazioni di Bocce tocca il cestino accanto a Carla (invitata) → conferma.
- **Atteso:** Carla sparisce dalla lista. **C**: nelle Notifiche non c'è più la scheda dell'invito a Bocce.
- [ ] OK

---

## 4. Notifiche e campanella (N)

### N-01 · Numero e lettura all'apertura
- Con qualche notifica non letta (es. **B** dopo G-06): la campanella mostra il numero (oltre 9 compare "9+").
- Apri le Notifiche.
- **Atteso:** le nuove sono in grassetto con un pallino a destra; tornando indietro il numero è sparito; riaprendo, le stesse non sono più evidenziate.
- [ ] OK

### N-02 · Chi agisce non riceve la propria notifica
- **A**: crea una spesa qualsiasi con Bruno.
- **Atteso:** la campanella di A non cambia; quella di B sì.
- [ ] OK

### N-03 · Una modifica senza cambiamenti non notifica
- **A**: apri Libro → matita → **Salva** senza toccare niente.
- **Atteso:** C non riceve nulla.
- **A**: modifica l'importo di Libro a 10 € → Salva.
- **Atteso:** C riceve "Anna.TB ha modificato “Libro” (10,00 €)".
- [ ] OK

### N-04 · Tolto da una spesa
- **A**: Libro → matita → togli il chip Carla.TB → Salva.
- **Atteso, C:** notifica "Anna.TB ti ha tolto da “Libro” (10,00 €)", **non** toccabile; le notifiche precedenti su Libro sono sparite dalla lista.
- [ ] OK

### N-05 · Spesa eliminata
- **A**: apri Gelato → cestino → conferma.
- **Atteso, B e D:** "Anna.TB ha eliminato “Gelato” (10,00 €)", non toccabile; le vecchie notifiche su Gelato sono sparite.
- [ ] OK

### N-06 · Rimborso
- **A**: tab Saldi → riga "Bruno.TB ti deve…" → **Salda** → importo 5 → salva.
- **Atteso, B:** "Anna.TB ha registrato un tuo rimborso di 5,00 €"; toccandola si apre la tab Saldi.
- Facoltativo: se è **B** a registrare che Anna gli ha dato qualcosa, ad A arriva "… a tuo favore".
- [ ] OK

### N-07 · Dove porta il tocco
- **Atteso:**
  - spesa aggiunta, modificata, da accettare o rifiutata → si apre il dettaglio della spesa;
  - aggiunto a un gruppo, entrato nel gruppo, invito rifiutato → si apre il gruppo;
  - rimborso → si apre la tab Saldi;
  - spesa eliminata, tolto da una spesa, amicizia accettata, invito ricevuto → la riga non si tocca.
- [ ] OK

### N-08 · Cambio utente nello stesso browser
- Nel browser di **A**: Profilo → Esci → entra come un altro utente.
- **Atteso:** la campanella mostra il numero del nuovo utente, mai per un istante quello di Anna. Rientra poi come Anna.
- [ ] OK

### N-09 · Ritorno in primo piano
- **A**: passa a un'altra scheda del browser (o metti la PWA in background).
- **B**: crea una spesa con Anna.
- **A**: torna sulla scheda di Split senza toccare nulla.
- **Atteso:** il numero sulla campanella si aggiorna da solo.
- [ ] OK

---

## 5. Regressione (X)

### X-01 · Le tab si aggiornano tornando da Notifiche e Profilo
- Già visto in A-06 e G-05. Ripetilo anche dal **Profilo**: cambia il nickname di un utente, torna indietro, e la tab visibile si ricarica.
- [ ] OK

### X-02 · Pagina Spese per categoria
- **B**: nuova spesa **50 €** `Museo`, categoria Altro, con Carla.TB (cercala: non sono amici).
- **C**: riquadro "Speso a <mese>" → pagina per categoria.
- **Atteso:** Museo non compare in nessuna categoria né nel totale. In Attività c'è "1 spesa da accettare". Lasciala in attesa per X-04.
- [ ] OK

### X-03 · Semplifica i debiti in un gruppo
- **A**: in Vacanze crea un paio di spese pagate da persone diverse → segmento Saldi → **Semplifica i debiti** → Applica.
- **Atteso:** funziona come prima. Tutti i membri sono accettati, quindi nessuna delle spese di compensazione è in attesa.
- [ ] OK

### X-04 · Inglese e tema scuro
- **C**: Profilo → Lingua English, tema scuro del sistema; apri le Notifiche (c'è ancora la richiesta di X-02).
- **Atteso:** testi tradotti ("Requests", "Bruno.TB wants to split expenses with you", "Accept Bruno.TB"), badge e riquadri leggibili. Rimetti l'italiano alla fine.
- [ ] OK

---

## 6. Controlli via API (facoltativi, S)

Il token di un utente si legge dai DevTools: Application → Local Storage → `split_auth` → `accessToken`. Il `publicId` di un utente: `GET /api/user?q=<nickname>`.

```
API=http://localhost:3000/api
TOKEN=...            # di chi fa la chiamata
```

| ID | Chiamata | Atteso |
|---|---|---|
| S-01 | `curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "Authorization: Bearer $TOKEN" $API/friend/<publicId di qualcuno che non ti ha mandato richieste>/accept` | `404`: nessuno diventa amico da solo |
| S-02 | `curl -s -H "Authorization: Bearer $TOKEN" "$API/user?q=a"` | `[]`: niente ricerca parziale |
| S-03 | `curl -s -o /dev/null -w '%{http_code}\n' -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"description":"x"}' $API/expense/<spesa in cui la tua quota è in attesa>` | `403` |
| S-04 | `curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" $API/group/<gruppo in cui sei solo invitato>` | `403` |
| S-05 | `curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"publicIds":["<id di una notifica di un altro utente>"]}' $API/notification/read` | `{"count":…}` con il tuo numero, e la notifica dell'altro resta non letta |

- [ ] S-01 OK · [ ] S-02 OK · [ ] S-03 OK · [ ] S-04 OK · [ ] S-05 OK

---

## Registro esiti

| ID | Esito | Note |
|---|---|---|
| R-01 … R-06 | | |
| A-01 … A-11 | | |
| G-01 … G-07 | | |
| N-01 … N-09 | | |
| X-01 … X-04 | | |
| S-01 … S-05 | | |

## Pulizia

I quattro utenti e i loro dati restano nel database di sviluppo. Non c'è uno script per eliminarli. Per ripartire da zero, `npx prisma migrate reset --schema=splitBack/prisma/schema.prisma` svuota **tutto** il DB di sviluppo; dopo vanno rilanciati `seed.ts` e `add-users.mts` (vedi `CLAUDE.md`).
