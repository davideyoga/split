import { BlockList, isIP } from 'node:net';

/**
 * Costruisce il valore di CLIENT_IP_HEADER, da cui Better Auth ricava l'IP del
 * client per il rate limit.
 *
 * Senza proxy fidati vale solo l'IP del socket: X-Forwarded-For lo scrive il
 * client e non conta nulla.
 *
 * Dietro un proxy si passa l'intera catena con in fondo l'IP del socket, e
 * Better Auth (`advanced.ipAddress.trustedProxies`) la legge da destra fermandosi
 * al primo indirizzo non fidato. L'IP del socket deve esserci perche' e' l'unico
 * hop che nessuno puo' scrivere: se la richiesta arriva direttamente, non da un
 * proxy, ci si ferma li' e l'X-Forwarded-For inventato non viene neanche letto.
 * I valori a sinistra del client vero sono falsificabili (Render non ripulisce
 * l'header in arrivo) e non vengono raggiunti.
 */
export function clientIpChain(
  socketAddress: string | undefined,
  forwardedFor: string | undefined,
  behindProxy: boolean,
): string {
  if (!socketAddress) {
    return '';
  }
  return behindProxy && forwardedFor ? `${forwardedFor}, ${socketAddress}` : socketAddress;
}

/**
 * I proxy fidati (AUTH_TRUSTED_PROXIES: IP o range CIDR, IPv4 o IPv6) in una
 * forma che si interroga in fretta. Una voce scritta male si salta con un
 * avviso: quell'hop viene preso per il client, e chi passa da li' condivide un
 * contatore, ma non si apre nessun buco.
 */
export function proxyBlockList(entries: string[], warn: (message: string) => void = () => undefined): BlockList {
  const list = new BlockList();
  for (const entry of entries) {
    const [address, prefix, ...rest] = entry.split('/');
    const family = isIP(address);
    const bits = prefix === undefined ? null : Number(prefix);
    const maxBits = family === 4 ? 32 : 128;
    if (
      family === 0 ||
      rest.length > 0 ||
      (bits !== null && (prefix === '' || !Number.isInteger(bits) || bits < 0 || bits > maxBits))
    ) {
      warn(`AUTH_TRUSTED_PROXIES: voce non valida ignorata: "${entry}"`);
      continue;
    }
    const type = family === 4 ? 'ipv4' : 'ipv6';
    if (bits === null) {
      list.addAddress(address, type);
    } else {
      list.addSubnet(address, bits, type);
    }
  }
  return list;
}

/**
 * L'IP del client per i limiti delle rotte Nest (RateLimitInterceptor), con la
 * stessa regola che Better Auth applica alla catena di clientIpChain: da destra,
 * il primo indirizzo che non e' un proxy fidato. Senza proxy fidati e' l'IP del
 * socket, e X-Forwarded-For non viene letto. Quello che sta a sinistra del
 * client vero lo scrive il client, e non viene mai raggiunto.
 */
export function clientIp(
  socketAddress: string | undefined,
  forwardedFor: string | undefined,
  proxies: BlockList,
): string {
  const socket = normalizeIp(socketAddress ?? '');
  if (!socket) {
    return '';
  }
  const chain = [...(forwardedFor ?? '').split(',').map(normalizeIp).filter(Boolean), socket];
  for (let i = chain.length - 1; i >= 0; i--) {
    if (!isTrustedProxy(chain[i], proxies)) {
      return chain[i];
    }
  }
  // Tutti proxy fidati: il piu' lontano.
  return chain[0];
}

// "::ffff:10.0.0.1" e' l'IPv4 10.0.0.1 visto da un socket IPv6: senza
// riportarlo a IPv4 non corrisponderebbe a un range fidato scritto in IPv4.
// Tagliato a 64 caratteri: un X-Forwarded-For inventato non diventa una chiave
// enorme nei contatori.
function normalizeIp(value: string): string {
  const address = value.trim().slice(0, 64);
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  return mapped ? mapped[1] : address;
}

function isTrustedProxy(address: string, proxies: BlockList): boolean {
  const family = isIP(address);
  return family !== 0 && proxies.check(address, family === 4 ? 'ipv4' : 'ipv6');
}
