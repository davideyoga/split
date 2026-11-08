import { clientIpChain } from './client-ip';

describe('clientIpChain', () => {
  it('senza proxy fidati usa solo il socket e ignora X-Forwarded-For', () => {
    expect(clientIpChain('203.0.113.9', '1.2.3.4', false)).toBe('203.0.113.9');
  });

  it('dietro un proxy mette il socket in fondo alla catena', () => {
    expect(clientIpChain('10.21.157.68', '99.61.165.29, 104.22.17.40', true)).toBe(
      '99.61.165.29, 104.22.17.40, 10.21.157.68',
    );
  });

  it('dietro un proxy, senza X-Forwarded-For, resta il socket', () => {
    expect(clientIpChain('10.21.157.68', undefined, true)).toBe('10.21.157.68');
  });

  it('senza indirizzo del socket non si fida di X-Forwarded-For', () => {
    expect(clientIpChain(undefined, '1.2.3.4', true)).toBe('');
  });
});
