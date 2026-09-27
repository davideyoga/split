// Porte dello stack e2e. Diverse da quelle di sviluppo (API 3000, web 4200),
// così i test possono girare mentre `nx serve` è acceso e non toccano mai
// l'API collegata a split-db. 4300 è anche in splitFront/project.json
// (serve:e2e), 3100 in splitFront/src/environments/environment.e2e.ts.
export const API_PORT = 3100;
export const WEB_PORT = 4300;

export const API_URL = `http://localhost:${API_PORT}/api`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;

/** Nome del database dei test: prepare-db.mts rifiuta qualsiasi nome che non finisca con "-e2e". */
export const E2E_DATABASE_NAME = 'split-db-e2e';
