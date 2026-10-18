import { expect, test } from '@playwright/test';
import { t } from './support/i18n';
import { visible } from './support/ionic';
import { apiLogin, createExpense, loginAs, presetCategoryId, USERS } from './support/session';

test('"Speso questo mese": pagina per categoria, giorno d\'inizio e periodi precedenti', async ({ page }) => {
  // "Oggi" fisso nel browser: il periodo in corso dipende dalla data.
  await page.clock.setFixedTime(new Date('2026-10-10T12:00:00'));

  const clarabella = await apiLogin(page.request, USERS.clarabella);
  const ciccio = await loginAs(page, USERS.ciccio);
  const food = await presetCategoryId(page.request, ciccio, 'food');
  const transport = await presetCategoryId(page.request, ciccio, 'transport');
  const groceries = await presetCategoryId(page.request, ciccio, 'groceries');

  // Ottobre: cibo 150 + metà di 100 con Clarabella = 200 (le mie quote), trasporti 800.
  await createExpense(page.request, ciccio, { amount: 150, description: 'Spesa', date: '2026-10-05', categoryPublicId: food });
  await createExpense(page.request, ciccio, { amount: 800, description: 'Treno', date: '2026-10-08', categoryPublicId: transport });
  await createExpense(page.request, ciccio, {
    amount: 100,
    description: 'Pizza',
    date: '2026-10-09',
    categoryPublicId: food,
    participantPublicIds: [clarabella.user.publicId],
  });
  // Settembre: dentro il periodo 25/09-24/10 solo la seconda.
  await createExpense(page.request, ciccio, { amount: 30, description: 'Panino', date: '2026-09-10', categoryPublicId: food });
  await createExpense(page.request, ciccio, { amount: 50, description: 'Frutta', date: '2026-09-27', categoryPublicId: groceries });

  // Riquadro in Attività: mese solare, quote mie (non quanto ho pagato)
  await page.goto('/tabs/activity');
  const card = visible(page.locator('app-monthly-spending ion-card'));
  await expect(card).toContainText(t('activity.month-spent-in', { month: 'October' }));
  await expect(card.locator('.tile-value')).toHaveText('€1,000.00');
  await expect(card).toContainText(t('activity.month-sub', { count: 3, paid: '1,050.00' }));

  // Toccandola si apre la pagina, sul periodo in corso
  await card.click();
  await expect(page.getByRole('heading', { name: '01/10/2026 – 31/10/2026' })).toBeVisible();
  await expect(page.getByText(t('spending.current'))).toBeVisible();
  await expect(page.getByRole('button', { name: t('spending.next') })).toBeDisabled();

  const rows = page.locator('ion-item.category-row');
  await expect(rows).toHaveCount(2);
  // Dalla categoria piu' alta: trasporti 80%, cibo 20%
  await expect(rows.nth(0)).toContainText(t('categories.transport'));
  await expect(rows.nth(0)).toContainText('€800.00');
  await expect(rows.nth(0)).toContainText('80%');
  await expect(rows.nth(1)).toContainText(t('categories.food'));
  await expect(rows.nth(1)).toContainText('€200.00');
  await expect(rows.nth(1)).toContainText('20%');
  await expect(page.locator('.donut-total')).toHaveText('€1,000.00');

  // Toccando una categoria si aprono le sue spese del periodo (non il panino
  // di settembre), dalla piu' recente, ciascuna con la mia quota
  await rows.nth(1).click();
  await expect(page).toHaveURL(/\/tabs\/activity\/spending\/category\?category=[0-9a-f-]{36}&from=2026-10-01&to=2026-10-31$/);
  const categoryPage = page.locator('app-spending-category');
  const items = categoryPage.locator('app-expense-list ion-item');
  await expect(categoryPage.locator('ion-title')).toContainText(t('categories.food'));
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('Pizza');
  await expect(items.nth(0)).toContainText(t('expense-list.you-paid', { amount: '€100.00' }));
  await expect(items.nth(0).locator('.main')).toHaveText('€50.00');
  await expect(items.nth(1)).toContainText('Spesa');
  await expect(items.nth(1)).toContainText(t('expense-list.only-you'));
  await expect(items.nth(1).locator('.main')).toHaveText('€150.00');
  await expect(categoryPage.locator('.total')).toHaveText('€200.00');

  // Una spesa della lista apre il suo dettaglio; indietro si torna alla lista
  await items.nth(0).click();
  await expect(page).toHaveURL(/\/tabs\/activity\/expense\/[0-9a-f-]{36}$/);
  await expect(visible(page.locator('app-expense-detail ion-title'))).toHaveText('Pizza');
  await visible(page.locator('app-expense-detail ion-back-button')).click();
  await expect(page).toHaveURL(/\/tabs\/activity\/spending\/category\?/);
  await expect(items).toHaveCount(2);
  await visible(categoryPage.locator('ion-back-button')).click();
  await expect(page).toHaveURL(/\/tabs\/activity\/spending$/);
  await expect(categoryPage).toHaveCount(0);

  // Il mese parte il 25 (stipendio): periodo 25/09-24/10, entra la frutta del 27/09
  await page.locator('ion-select').click();
  await page.locator('ion-popover').getByRole('radio', { name: '25', exact: true }).click();
  await expect(page.getByRole('heading', { name: '25/09/2026 – 24/10/2026' })).toBeVisible();
  await expect(page.locator('.donut-total')).toHaveText('€1,050.00');
  await expect(rows).toHaveCount(3);
  // 76.19 / 19.05 / 4.76: i resti maggiori fanno 76 + 19 + 5 = 100
  await expect(rows.nth(0)).toContainText('76%');
  await expect(rows.nth(1)).toContainText('19%');
  await expect(rows.nth(2)).toContainText(t('categories.groceries'));
  await expect(rows.nth(2)).toContainText('5%');

  // Periodo precedente: 25/08-24/09, solo il panino del 10/09
  await page.getByRole('button', { name: t('spending.previous') }).click();
  await expect(page.getByRole('heading', { name: '25/08/2026 – 24/09/2026' })).toBeVisible();
  await expect(page.getByText(t('spending.current'))).toBeHidden();
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toContainText('€30.00');
  await expect(rows.nth(0)).toContainText('100%');
  await page.getByRole('button', { name: t('spending.next') }).click();
  await expect(page.getByRole('heading', { name: '25/09/2026 – 24/10/2026' })).toBeVisible();

  // La card segue lo stesso periodo, anche dopo un riavvio (giorno salvato sul dispositivo)
  await page.goto('/tabs/activity');
  await expect(card).toContainText(t('activity.month-spent-since', { date: '25/09' }));
  await expect(card).toContainText('€1,050.00');
});
