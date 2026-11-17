/**
 * Tetti sui dati che arrivano dai client (2026-11-14). Senza, un account poteva
 * salvare testi da 100 KB (il limite del body parser) e importi come 1e300, che
 * nel frontend rovinano i saldi, calcolati in centesimi interi, di chiunque sia
 * nella spesa.
 *
 * I campi di testo mostrati nell'app hanno lo stesso `maxlength` nel frontend:
 * cambiando un valore qui, cambiarlo anche li'.
 */

// Un miliardo: in centesimi (1e11) resta lontanissimo dal massimo intero
// esatto di JavaScript (9e15), anche sommando tutte le spese di un utente.
export const MAX_AMOUNT = 1_000_000_000;

// Descrizione di una spesa e nota di un rimborso (decisione dell'utente,
// 2026-11-15). Lo stesso tetto e' sulle colonne del DB (VARCHAR(300),
// migrazione 20261115120000_limit_text_lengths): cambiarlo vuol dire una
// migrazione.
export const MAX_TEXT_LENGTH = 300;
export const MAX_GROUP_NAME_LENGTH = 60;
export const MAX_CATEGORY_NAME_LENGTH = 40;
// Nome di una ionicon ("pricetag-outline") e colore CSS ("#0F5E56").
export const MAX_CATEGORY_ICON_LENGTH = 40;
export const MAX_CATEGORY_COLOR_LENGTH = 20;

// I publicId sono UUID di 36 caratteri.
export const MAX_PUBLIC_ID_LENGTH = 64;

// Persone aggiunte a mano a una spesa, oltre al creatore e ai membri del gruppo.
export const MAX_PARTICIPANTS = 100;
// Le quote nominano tutti i contributori: partecipanti piu' membri del gruppo.
export const MAX_SHARES = 500;
