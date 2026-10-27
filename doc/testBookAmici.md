Scritto per: chi esegue i test a mano sull'ambiente locale, cioè tu o un tester con accesso al repo e al log del backend.

Ho scritto il test book in doc/TestBook.md: 42 casi di test, da eseguire in ordine perché ognuno parte dallo stato lasciato dal precedente. Gli importi attesi li ho ricalcolati passo per passo, ma non ho ancora eseguito il test book io stesso.

Preparazione

Si parte da quattro utenti nuovi senza dati: Anna.TB, Bruno.TB, Carla.TB e Dario.TB. Il file contiene il comando add-users.mts già pronto per crearli, così i saldi partono da zero. Gli utenti Disney del DB di sviluppo hanno già spese fra loro.
Il login avviene con il codice stampato nel log del backend (MAIL_TRANSPORT=console).
Serve un contesto browser separato per ogni utente, perché la sessione sta nel localStorage. Due finestre in incognito dello stesso Chrome condividono la sessione, quindi non bastano.
Sezioni

Sezione	Casi	Cosa copre
R · Ricerca	6	nickname esatto, parte del nome, email, sé stessi, niente ricerca mentre scrivi, errore di rete
A · Spese in attesa	11	conta per chi la crea ma non per l'altro, richieste per persona, rifiuto e accettazione dalle Notifiche e dal dettaglio, pagante che rifiuta, amicizia con chi ti aggiunge e non con il creatore
G · Gruppi e inviti	7	amico che entra subito, invitato che non vede il gruppo, spese che lo escludono, rifiuto e accettazione (amico di tutti i membri), aggiunta e annullamento dalle impostazioni
N · Notifiche	9	badge, lettura all'apertura, chi agisce non riceve nulla, modifica identica, tolto da una spesa, spesa eliminata, rimborso, dove porta il tocco, cambio utente, ritorno in primo piano
X · Regressione	4	aggiornamento tornando da Profilo e Notifiche, pagina Spese, Semplifica i debiti, inglese e tema scuro
S · API, facoltativi	5	controlli con curl: farsi amici senza richiesta, ricerca parziale, permessi di chi è in attesa o solo invitato
Ogni caso indica utenti, passi e risultato atteso con i testi esatti dell'app, più una casella da spuntare. In fondo c'è una tabella per registrare gli esiti e una nota su come ripulire il DB.

Se lo vuoi girare a dei tester, posso anche pubblicarlo come pagina con le caselle cliccabili.