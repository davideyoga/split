import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';
import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';
import { API_PORT, API_URL, E2E_DATABASE_NAME, WEB_URL } from './src/support/env';

// JWT_SECRET e DATABASE_URL arrivano dal .env della root. `nx e2e` lo carica
// già, `npx playwright test` lanciato a mano no. Non sovrascrive variabili già
// impostate.
loadEnv({ path: join(workspaceRoot, '.env') });

/**
 * URL del database dei test: E2E_DATABASE_URL se impostato, altrimenti lo
 * stesso server di DATABASE_URL con il database split-db-e2e. Mai il database
 * di sviluppo: prepare-db.mts lo svuota a ogni esecuzione.
 */
function e2eDatabaseUrl(): string {
  const explicit = process.env['E2E_DATABASE_URL'];
  if (explicit) {
    return explicit;
  }
  const dev = process.env['DATABASE_URL'];
  if (!dev) {
    throw new Error('DATABASE_URL mancante: copia .env.example in .env (vedi CLAUDE.md).');
  }
  const url = new URL(dev);
  url.pathname = `/${E2E_DATABASE_NAME}`;
  return url.toString();
}

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  // I file di test girano in parallelo (ognuno usa utenti suoi, vedi
  // support/session.ts); i test dentro un file in ordine.
  fullyParallel: false,
  use: {
    baseURL: WEB_URL,
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      // DB e2e da zero + build + API sulla porta 3100. Mai riusata: ogni
      // esecuzione riparte dal seed, e una porta già occupata è un errore.
      name: 'api',
      command:
        'node splitFront-e2e/scripts/prepare-db.mts' +
        ' && npx nx build splitBack --configuration=development' +
        ' && node splitBack/dist/main.js',
      url: API_URL,
      cwd: workspaceRoot,
      env: { DATABASE_URL: e2eDatabaseUrl(), PORT: String(API_PORT) },
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      // Dev server Angular con environment.e2e.ts (API sulla 3100), porta 4300.
      name: 'web',
      command: 'npx nx serve splitFront --configuration=e2e',
      url: WEB_URL,
      cwd: workspaceRoot,
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
  ],
  // L'app è pensata prima di tutto per il telefono.
  projects: [{ name: 'mobile-chrome', use: { ...devices['Pixel 7'] } }],
});
