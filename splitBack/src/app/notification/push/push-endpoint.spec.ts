import { createECDH, randomBytes } from 'node:crypto';
import { isSupportedPushEndpoint, isValidWebPushKeys, MAX_ENDPOINT_LENGTH } from './push-endpoint';

describe('isSupportedPushEndpoint', () => {
  it('accetta i servizi di consegna dei browser', () => {
    for (const endpoint of [
      'https://fcm.googleapis.com/fcm/send/abc:APA91b',
      'https://updates.push.services.mozilla.com/wpush/v2/gAAAAA',
      'https://wns2-par02p.notify.windows.com/w/?token=BQYAAA',
      'https://web.push.apple.com/QGuQyavXutnMH',
    ]) {
      expect({ endpoint, ok: isSupportedPushEndpoint(endpoint) }).toEqual({ endpoint, ok: true });
    }
  });

  it('rifiuta tutto il resto: altri host, http, porte, credenziali, sosia', () => {
    for (const endpoint of [
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://fcm.googleapis.com:8443/fcm/send/abc',
      'https://user:pw@fcm.googleapis.com/fcm/send/abc',
      'https://fcm.googleapis.com.evil.example/x',
      'https://evil.example/fcm.googleapis.com',
      'https://notpush.apple.com/x',
      'https://storage.googleapis.com/x',
      'https://10.0.0.1/x',
      'https://localhost/x',
      'non un url',
      `https://fcm.googleapis.com/${'a'.repeat(MAX_ENDPOINT_LENGTH)}`,
    ]) {
      expect({ endpoint, ok: isSupportedPushEndpoint(endpoint) }).toEqual({ endpoint, ok: false });
    }
  });
});

describe('isValidWebPushKeys', () => {
  const p256dh = createECDH('prime256v1').generateKeys().toString('base64url');
  const auth = randomBytes(16).toString('base64url');

  it('accetta le chiavi di un browser vero (65 + 16 byte, base64url)', () => {
    expect(isValidWebPushKeys(p256dh, auth)).toBe(true);
    // Qualche browser le manda con il padding.
    expect(isValidWebPushKeys(`${p256dh}=`, `${auth}==`)).toBe(true);
  });

  it('rifiuta lunghezze sbagliate e caratteri fuori da base64url', () => {
    expect(isValidWebPushKeys(randomBytes(32).toString('base64url'), auth)).toBe(false);
    expect(isValidWebPushKeys(p256dh, randomBytes(8).toString('base64url'))).toBe(false);
    expect(isValidWebPushKeys(p256dh.replace(/.$/, '+'), auth)).toBe(false);
    expect(isValidWebPushKeys('', '')).toBe(false);
  });
});
