// Usato solo dalla configurazione `e2e` di splitFront (project.json), che
// lo sostituisce a environment.ts: i test Playwright (splitFront-e2e) parlano
// con un'API dedicata sulla porta 3100, collegata al database split-db-e2e.
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3100/api'
};
