export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  // Login con Google e Apple (doc/Auth.md): vuoti = pulsante nascosto. Sono
  // dati pubblici (finiscono comunque nel bundle). Devono coincidere con
  // GOOGLE_CLIENT_ID / APPLE_CLIENT_ID del backend, che verifica i token.
  googleClientId: '',
  appleClientId: '',
  // Pagina https registrata nel Services ID di Apple: col popup Apple non ci
  // naviga, ma la vuole comunque (e non accetta localhost).
  appleRedirectUri: '',
};