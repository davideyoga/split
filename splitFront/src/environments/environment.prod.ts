// Usato dalla configurazione `production` di splitFront (project.json), che lo
// sostituisce a environment.ts: backend pubblicato su Render (web service
// gratuito, branch `test`), vedi doc/DECISIONI_HOSTING.md.
export const environment = {
  production: true,
  apiUrl: 'https://split-eued.onrender.com/api'
};
