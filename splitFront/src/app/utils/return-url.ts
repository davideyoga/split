/**
 * Dove andare dopo login o /welcome: `returnUrl` arriva dalla guard (deep link
 * senza sessione, o nickname ancora da scegliere) o dall'interceptor (401).
 * Solo percorsi interni: niente URL assoluti o protocol-relative ("//host"),
 * per non trasformare il login in un open redirect, e niente /login o /welcome
 * (si girerebbe in tondo).
 */
export function safeReturnUrl(url: string | null): string {
  if (url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/login') && !url.startsWith('/welcome')) {
    return url;
  }
  return '/tabs/activity';
}
