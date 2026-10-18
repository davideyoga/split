// Iniziale maiuscola di un nickname, per il cerchio accanto a una persona
// (classe globale `.avatar.initial`). Il primo carattere intero, non la prima
// unita' UTF-16, cosi' un nome che inizia con un'emoji non si spezza.
export function initialOf(name: string | null | undefined): string {
  const first = Array.from((name ?? '').trim())[0] ?? '?';
  return first.toLocaleUpperCase();
}
