const MIN_SECRET_LENGTH = 32;
// Il valore di esempio di .env.example: copiato cosi' com'e' e' pubblico.
const PLACEHOLDER_SECRET = 'stringa_casuale_lunga_a_tua_scelta';

/**
 * Il segreto di Better Auth, obbligatorio (2026-11-14): se manca, e' corto o e'
 * il valore di esempio, l'API non parte. Better Auth da solo ripiega su un
 * segreto di sviluppo pubblico, con un semplice avviso nel log, tranne che con
 * NODE_ENV=production: su Render NODE_ENV non e' impostato
 * (doc/DECISIONI_HOSTING.md), quindi una variabile dimenticata avrebbe fatto
 * girare la produzione con quel segreto.
 */
export function authSecret(): string {
  const secret = process.env['BETTER_AUTH_SECRET'] ?? '';
  if (secret.length < MIN_SECRET_LENGTH || secret === PLACEHOLDER_SECRET) {
    throw new Error(
      `BETTER_AUTH_SECRET mancante, piu' corto di ${MIN_SECRET_LENGTH} caratteri o uguale all'esempio: ` +
        'generane uno come spiega .env.example',
    );
  }
  return secret;
}
