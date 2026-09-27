import type { MailMessage } from '../mail/mail.service';

/**
 * Email con il codice di accesso. E' l'unico testo per l'utente generato dal
 * backend, quindi le traduzioni stanno qui e non in splitFront/src/assets/i18n.
 * La lingua arriva dall'header Accept-Language, che il frontend imposta con la
 * lingua scelta nell'app (AuthService.requestCode).
 */
type Lang = 'it' | 'en';

const TEXTS: Record<Lang, { subject: string; intro: string; expiry: string; ignore: string }> = {
  it: {
    subject: 'Il tuo codice di accesso a Split',
    intro: 'Ecco il tuo codice per entrare in Split:',
    expiry: 'Il codice scade tra {minutes} minuti.',
    ignore: 'Se non hai chiesto tu di entrare, ignora questa email.',
  },
  en: {
    subject: 'Your Split sign-in code',
    intro: 'Here is your code to sign in to Split:',
    expiry: 'The code expires in {minutes} minutes.',
    ignore: "If you didn't try to sign in, you can ignore this email.",
  },
};

export function pickLang(acceptLanguage: string | null | undefined): Lang {
  return acceptLanguage?.trim().toLowerCase().startsWith('it') ? 'it' : 'en';
}

export function otpEmail(to: string, otp: string, lang: Lang, expiresInMinutes: number): MailMessage {
  const t = TEXTS[lang];
  const expiry = t.expiry.replace('{minutes}', String(expiresInMinutes));
  return {
    to,
    subject: t.subject,
    text: `${t.intro}\n\n${otp}\n\n${expiry}\n${t.ignore}`,
    html:
      `<p>${t.intro}</p>` +
      `<p style="font-size:32px;font-weight:bold;letter-spacing:6px;font-family:monospace">${otp}</p>` +
      `<p>${expiry}<br>${t.ignore}</p>`,
  };
}
