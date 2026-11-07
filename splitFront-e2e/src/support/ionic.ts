import { expect, type Locator, type Page } from '@playwright/test';

/**
 * La modale in primo piano. Ionic aggiunge le modali in fondo al body e le
 * rimuove alla chiusura, quindi con due modali aperte (form spesa → scelta
 * partecipante) l'ultima è quella visibile sopra.
 * Le modali inline (il calendario della data nella form spesa, con
 * `keepContentsMounted`) restano invece nel DOM anche chiuse, con la classe
 * `overlay-hidden`: vanno escluse, come fa Ionic stesso per contarle.
 */
export function topModal(page: Page): Locator {
  return page.locator('ion-modal:not(.overlay-hidden)').last();
}

/**
 * Solo gli elementi visibili. La shell a tab tiene montate le pagine già
 * visitate (classe `ion-page-hidden`, `display: none`): senza questo filtro un
 * testo presente sia nella lista sia nel dettaglio trova due elementi.
 */
export function visible(locator: Locator): Locator {
  return locator.filter({ visible: true });
}

/** Aspetta il toast con quel testo (i toast restano visibili qualche secondo). */
export function toast(page: Page, text: string): Locator {
  return page.locator('ion-toast').filter({ hasText: text });
}

/**
 * fill() su un ion-input, ripetuto finche' il valore resta nel campo. Sotto
 * carico (suite intera, 4 worker) Ionic ogni tanto perdeva il testo appena
 * scritto, e la spesa si salvava senza descrizione (vedi CLAUDE.md, E2E
 * tests, Known gaps). Da solo non si riproduce.
 */
export async function fillInput(locator: Locator, value: string): Promise<void> {
  await expect(async () => {
    await locator.fill(value);
    await expect(locator).toHaveValue(value, { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
}
