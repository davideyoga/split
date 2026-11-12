/**
 * Controlli su un dispositivo Web Push prima di salvarlo (doc/NotifichePush.md).
 *
 * L'endpoint e' un URL scelto dal browser, a cui il server poi fa una POST per
 * ogni push. Senza una lista chiusa, chiunque abbia un account potrebbe
 * registrare un indirizzo qualsiasi (la rete interna di Render, un servizio di
 * terzi) e far fare al server richieste a suo nome (SSRF). Si accettano solo i
 * servizi di consegna dei browser.
 */

// Host esatti.
const PUSH_SERVICE_HOSTS = [
  // Chrome e i browser basati su Chromium (Edge su Android, Opera, Samsung Internet).
  'fcm.googleapis.com',
];

// Domini con i loro sottodomini.
const PUSH_SERVICE_DOMAINS = [
  // Firefox: updates.push.services.mozilla.com.
  'push.services.mozilla.com',
  // Edge su Windows: wns2-<regione>.notify.windows.com.
  'notify.windows.com',
  // Safari su macOS e iOS 16.4+: web.push.apple.com.
  'push.apple.com',
];

export const MAX_ENDPOINT_LENGTH = 2048;

export function isSupportedPushEndpoint(endpoint: string): boolean {
  if (endpoint.length > MAX_ENDPOINT_LENGTH) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  // Niente credenziali e niente porte: solo https sulla porta standard.
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    return false;
  }
  const host = url.hostname.toLowerCase();
  return (
    PUSH_SERVICE_HOSTS.includes(host) ||
    PUSH_SERVICE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))
  );
}

/**
 * Le chiavi di cifratura del browser (PushSubscription.toJSON().keys), in
 * base64url: p256dh e' una chiave pubblica P-256 non compressa (65 byte),
 * auth un segreto di 16 byte. Con lunghezze sbagliate web-push rifiuterebbe
 * ogni invio, e il dispositivo resterebbe in tabella a fallire per sempre.
 */
export function isValidWebPushKeys(p256dh: string, auth: string): boolean {
  return decodedLength(p256dh) === 65 && decodedLength(auth) === 16;
}

function decodedLength(value: string): number {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value)) {
    return -1;
  }
  return Buffer.from(value, 'base64url').length;
}
