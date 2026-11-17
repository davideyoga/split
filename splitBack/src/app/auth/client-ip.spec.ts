import { clientIp, clientIpChain, proxyBlockList } from './client-ip';

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

describe('clientIp', () => {
  // La forma di Render: client, edge Cloudflare, socket nella rete interna.
  const render = proxyBlockList(['10.0.0.0/8', '104.16.0.0/13', '2400:cb00::/32']);
  const none = proxyBlockList([]);

  it('senza proxy fidati usa il socket e ignora X-Forwarded-For', () => {
    expect(clientIp('203.0.113.9', '1.2.3.4', none)).toBe('203.0.113.9');
  });

  it('dietro i proxy fidati prende il primo indirizzo non fidato da destra', () => {
    expect(clientIp('10.21.157.68', '99.61.165.29, 104.22.17.40', render)).toBe('99.61.165.29');
  });

  it('non raggiunge gli indirizzi inventati a sinistra del client', () => {
    expect(clientIp('10.21.157.68', '6.6.6.6, 99.61.165.29, 104.22.17.40', render)).toBe('99.61.165.29');
  });

  it('una richiesta arrivata direttamente non fa leggere X-Forwarded-For', () => {
    expect(clientIp('203.0.113.9', '6.6.6.6', render)).toBe('203.0.113.9');
  });

  it('riconosce un proxy IPv4 visto da un socket IPv6', () => {
    expect(clientIp('::ffff:10.21.157.68', '99.61.165.29', render)).toBe('99.61.165.29');
  });

  it('riconosce i range IPv6', () => {
    expect(clientIp('10.21.157.68', '2001:db8::7, 2400:cb00:12::1', render)).toBe('2001:db8::7');
  });

  it('se sono tutti proxy fidati prende il piu\' lontano', () => {
    expect(clientIp('10.0.0.2', '10.0.0.9, 104.16.0.1', render)).toBe('10.0.0.9');
  });

  it('un valore che non e\' un IP conta come client, tagliato a 64 caratteri', () => {
    expect(clientIp('10.0.0.2', 'x'.repeat(500), render)).toBe('x'.repeat(64));
  });

  it('senza indirizzo del socket non si fida di niente', () => {
    expect(clientIp(undefined, '1.2.3.4', render)).toBe('');
  });
});

describe('proxyBlockList', () => {
  it('accetta indirizzi singoli e range, IPv4 e IPv6', () => {
    const list = proxyBlockList(['192.0.2.1', '10.0.0.0/8', '2400:cb00::/32']);
    expect(list.check('192.0.2.1', 'ipv4')).toBe(true);
    expect(list.check('192.0.2.2', 'ipv4')).toBe(false);
    expect(list.check('10.200.1.1', 'ipv4')).toBe(true);
    expect(list.check('2400:cb00:1::1', 'ipv6')).toBe(true);
  });

  it('salta le voci scritte male e lo dice', () => {
    const warnings: string[] = [];
    const list = proxyBlockList(['ciao', '10.0.0.0/99', '10.0.0.0/', '10.0.0.0/8/1', '192.0.2.1'], (m) => warnings.push(m));
    expect(warnings).toHaveLength(4);
    expect(list.check('192.0.2.1', 'ipv4')).toBe(true);
    expect(list.check('10.1.1.1', 'ipv4')).toBe(false);
  });
});
