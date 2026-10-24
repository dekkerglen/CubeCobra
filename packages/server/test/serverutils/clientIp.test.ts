import { clientIp, isFromCloudflare } from 'serverutils/clientIp';

describe('clientIp', () => {
  it('trusts CF-Connecting-IP when the peer is a Cloudflare edge', () => {
    const req = { ip: '172.70.1.2', headers: { 'cf-connecting-ip': '203.0.113.9' } };
    expect(isFromCloudflare(req)).toBe(true);
    expect(clientIp(req)).toBe('203.0.113.9');
  });

  it('trusts it for IPv6 and IPv4-mapped edge addresses', () => {
    expect(clientIp({ ip: '2606:4700::1', headers: { 'cf-connecting-ip': '2001:db8::5' } })).toBe('2001:db8::5');
    expect(clientIp({ ip: '::ffff:104.16.0.1', headers: { 'cf-connecting-ip': '198.51.100.7' } })).toBe('198.51.100.7');
  });

  it('ignores CF-Connecting-IP from anywhere else (direct-to-origin spoofing)', () => {
    const req = { ip: '198.51.100.20', headers: { 'cf-connecting-ip': '1.2.3.4' } };
    expect(isFromCloudflare(req)).toBe(false);
    expect(clientIp(req)).toBe('198.51.100.20');
  });

  it('ignores a malformed header even from Cloudflare', () => {
    expect(clientIp({ ip: '172.70.1.2', headers: { 'cf-connecting-ip': 'not-an-ip' } })).toBe('172.70.1.2');
  });

  it('falls back to req.ip, then empty', () => {
    expect(clientIp({ ip: '10.0.0.5', headers: {} })).toBe('10.0.0.5');
    expect(clientIp({ headers: {} })).toBe('');
  });
});
