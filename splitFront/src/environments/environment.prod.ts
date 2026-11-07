// Usato dalla configurazione `production` di splitFront (project.json), che lo
// sostituisce a environment.ts: backend pubblicato su Render (web service
// gratuito, branch `test`), vedi doc/DECISIONI_HOSTING.md.
export const environment = {
  production: true,
  apiUrl: 'https://split-eued.onrender.com/api',
  // Login con Google e Apple (doc/Auth.md): vuoti = pulsante nascosto. Sono
  // dati pubblici (finiscono comunque nel bundle). Devono coincidere con
  // GOOGLE_CLIENT_ID / APPLE_CLIENT_ID del backend, che verifica i token.
  googleClientId: '',
  appleClientId: '',
  // Pagina https registrata nel Services ID di Apple: col popup Apple non ci
  // naviga, ma la vuole comunque (e non accetta localhost).
  appleRedirectUri: '',
};
