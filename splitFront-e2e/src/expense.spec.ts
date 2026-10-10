import { expect, test } from '@playwright/test';
import { API_URL } from './support/env';
import { t } from './support/i18n';
import { toast, topModal, visible } from './support/ionic';
import { loginAs, USERS } from './support/session';

// Stesso formato dei template (`date: 'dd/MM/yyyy'`).
function label(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

// Un giorno dello stesso mese diverso da `today` (cosi' il calendario non
// deve cambiare mese).
function otherDayThisMonth(today: Date): Date {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() === 1 ? 2 : 1);
}

test('nuova spesa divisa in parti uguali, dettaglio ed eliminazione', async ({ page }) => {
  await loginAs(page, USERS.pippo);
  await page.goto('/tabs/activity');

  // FAB → modale "Nuova spesa"
  await page.getByRole('button', { name: t('expense-form.title-new') }).click();
  await topModal(page).getByRole('textbox', { name: t('expense-form.amount') }).fill('30');
  await topModal(page)
    .getByRole('textbox', { name: t('expense-form.description-label') })
    .fill('Cena al lago');

  // "Dividi con" → modale di scelta (sopra la form) → Pluto
  await topModal(page).getByRole('button', { name: t('expense-form.split-with') }).click();
  await topModal(page).getByPlaceholder(t('select-participant.search-placeholder')).fill('Plut');
  await topModal(page).getByRole('button', { name: 'Pluto', exact: true }).click();

  // Tornati alla form: 30 € in due
  await expect(
    topModal(page).getByText(t('expense-form.split-each', { amount: '15.00' })),
  ).toBeVisible();
  await topModal(page).getByRole('button', { name: t('expense-form.save') }).click();
  await expect(toast(page, t('expense-form.created'))).toBeVisible();

  // La spesa è in cima ad Activity; il dettaglio mostra le quote
  await visible(page.getByText('Cena al lago')).click();
  await expect(page).toHaveURL(/\/tabs\/activity\/expense\/[0-9a-f-]{36}$/);
  // Per ruolo, non per testo: durante la transizione Activity (che mostra
  // anch'essa "30.00 EUR") è ancora visibile sotto il dettaglio.
  await expect(page.getByRole('heading', { name: '30.00 EUR' })).toBeVisible();
  await expect(
    visible(page.locator('ion-item').filter({ hasText: 'Pluto' })),
  ).toContainText('15.00 EUR');

  // Elimina, con conferma
  await page.getByRole('button', { name: t('expense-detail.delete') }).click();
  await page
    .locator('ion-alert')
    .getByRole('button', { name: t('expense-detail.delete') })
    .click();
  await expect(toast(page, t('expense-detail.deleted'))).toBeVisible();
  await expect(page).toHaveURL(/\/tabs\/activity$/);
  await expect(visible(page.getByText(t('activity.empty-title')))).toBeVisible();
});

test('data della spesa: oggi di default, modificabile; la data di inserimento la decide il server', async ({ page }) => {
  const session = await loginAs(page, USERS.pippo);
  const auth = { Authorization: `Bearer ${session.accessToken}` };
  await page.goto('/tabs/activity');

  // Nuova spesa senza toccare la data: vale oggi
  await page.getByRole('button', { name: t('expense-form.title-new') }).click();
  await topModal(page).getByRole('textbox', { name: t('expense-form.amount') }).fill('12');
  await topModal(page)
    .getByRole('textbox', { name: t('expense-form.description-label') })
    .fill('Gelato');
  await topModal(page).getByRole('button', { name: t('expense-form.save') }).click();
  await expect(toast(page, t('expense-form.created'))).toBeVisible();

  const today = new Date();
  const row = visible(page.locator('ion-item').filter({ hasText: 'Gelato' }));
  await expect(row).toContainText(label(today));

  // Dettaglio → Modifica → un altro giorno dello stesso mese dal calendario
  await row.click();
  await expect(page).toHaveURL(/\/tabs\/activity\/expense\/[0-9a-f-]{36}$/);
  await expect(visible(page.getByText(t('expense-detail.created', { date: label(today) })))).toBeVisible();
  await page.getByRole('button', { name: t('expense-detail.edit') }).click();
  await expect(topModal(page).getByText(t('expense-form.title-edit'))).toBeVisible();
  await topModal(page).locator('ion-datetime-button').click();

  const target = otherDayThisMonth(today);
  await topModal(page)
    .locator(
      `.calendar-day[data-day="${target.getDate()}"][data-month="${target.getMonth() + 1}"][data-year="${target.getFullYear()}"]`,
    )
    .click();
  await topModal(page).getByRole('button', { name: t('expense-form.date-done') }).click();
  await topModal(page).getByRole('button', { name: t('expense-form.save') }).click();
  await expect(toast(page, t('expense-form.updated'))).toBeVisible();
  // Nel dettaglio, non nella form che sta ancora chiudendosi (anche lei ha
  // una riga "Date").
  await expect(
    visible(page.locator('app-expense-detail ion-item').filter({ hasText: t('expense-detail.date') })),
  ).toContainText(label(target));

  // `createdDate` non e' nei DTO: mandata dal client viene scartata, sia in
  // modifica sia in creazione.
  const publicId = page.url().split('/').pop() as string;
  const before = await (await page.request.get(`${API_URL}/expense/${publicId}`, { headers: auth })).json();
  const patched = await page.request.patch(`${API_URL}/expense/${publicId}`, {
    headers: auth,
    data: { createdDate: '2000-01-01T00:00:00.000Z' },
  });
  expect(patched.ok()).toBeTruthy();
  expect((await patched.json()).createdDate).toBe(before.createdDate);

  const created = await page.request.post(`${API_URL}/expense`, {
    headers: auth,
    data: { amount: 5, date: '2026-01-15', createdDate: '2000-01-01T00:00:00.000Z' },
  });
  expect(created.ok()).toBeTruthy();
  const body = await created.json();
  expect(body.date.slice(0, 10)).toBe('2026-01-15');
  expect(new Date(body.createdDate).getFullYear()).not.toBe(2000);
});
