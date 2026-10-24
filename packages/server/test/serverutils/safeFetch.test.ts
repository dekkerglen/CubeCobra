import http from 'http';
import { AddressInfo } from 'net';

import { isPublicAddress, parseFetchableUrl, safeFetch, SafeFetchError } from 'serverutils/safeFetch';

describe('isPublicAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fe80::1',
    'fd00::1',
    '::ffff:127.0.0.1',
    '64:ff9b::a00:1',
  ])('rejects %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it.each(['8.8.8.8', '104.16.0.1', '2606:4700::1111'])('accepts %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });

  it('rejects things that are not IP literals', () => {
    expect(isPublicAddress('localhost')).toBe(false);
  });
});

describe('parseFetchableUrl', () => {
  it.each([
    'file:///etc/passwd',
    'javascript:alert(1)',
    'gopher://example.com/',
    'http://user:pass@example.com/',
    'http://example.com:8080/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'not a url',
  ])('rejects %s', (url) => {
    expect(() => parseFetchableUrl(url)).toThrow(SafeFetchError);
  });

  it('accepts ordinary http(s) URLs', () => {
    expect(parseFetchableUrl('https://cards.scryfall.io/normal/front/a.jpg').hostname).toBe('cards.scryfall.io');
    expect(parseFetchableUrl('http://example.com:80/x').hostname).toBe('example.com');
  });
});

describe('safeFetch', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    server = http.createServer((_req, res) => res.end('internal'));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('refuses hostnames that resolve to loopback', async () => {
    await expect(safeFetch('http://localhost/')).rejects.toThrow(/non-public/);
  });

  it('refuses non-standard ports before connecting', async () => {
    await expect(safeFetch(`http://localhost:${port}/`)).rejects.toThrow(SafeFetchError);
  });

  it('refuses loopback literals', async () => {
    await expect(safeFetch('http://127.0.0.1/')).rejects.toThrow(SafeFetchError);
  });
});
