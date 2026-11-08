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
