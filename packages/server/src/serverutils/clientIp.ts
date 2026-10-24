import type { IncomingHttpHeaders } from 'http';
import net from 'net';

/**
 * Anything request-shaped enough to carry a client address. Typed structurally so this
 * accepts both express's Request and the augmented one in types/express, which are not
 * assignable to each other.
 */
interface RequestLike {
  headers: IncomingHttpHeaders;
  ip?: string | undefined;
}

// Cloudflare's published edge ranges (https://www.cloudflare.com/ips-v4 and /ips-v6, fetched
// 2026-10-22). They change rarely; CLOUDFLARE_IP_RANGES (comma-separated CIDRs) replaces this
// list without a deploy if they do.
const DEFAULT_CLOUDFLARE_RANGES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

const buildCloudflareList = (): net.BlockList => {
  const list = new net.BlockList();
  const ranges = process.env.CLOUDFLARE_IP_RANGES
    ? process.env.CLOUDFLARE_IP_RANGES.split(',').map((range) => range.trim())
    : DEFAULT_CLOUDFLARE_RANGES;
  for (const range of ranges) {
    const [address, prefix] = range.split('/');
    const family = net.isIP(address ?? '');
    if (!address || !prefix || family === 0) continue;
    list.addSubnet(address, Number(prefix), family === 6 ? 'ipv6' : 'ipv4');
  }
  return list;
};

const cloudflare = buildCloudflareList();

const normalize = (ip: string): string => (ip.startsWith('::ffff:') && net.isIPv4(ip.slice(7)) ? ip.slice(7) : ip);

/** True when the connecting peer (as resolved through `trust proxy`) is a Cloudflare edge. */
export const isFromCloudflare = (req: RequestLike): boolean => {
  if (!req.ip) return false;
  const peer = normalize(req.ip);
  const family = net.isIP(peer);
  if (family === 0) return false;
  return cloudflare.check(peer, family === 6 ? 'ipv6' : 'ipv4');
};

/**
 * The visitor's address.
 *
 * `trust proxy` stops at the ALB, so req.ip is the Cloudflare edge for proxied traffic.
 * CF-Connecting-IP carries the real visitor, but it is only an honest header when the
 * request actually came through Cloudflare: anyone who reaches the ALB directly can set it
 * to anything. So it is believed only when req.ip is inside Cloudflare's ranges; otherwise
 * req.ip itself (which can't be forged past the trusted hops) is the client.
 */
export const clientIp = (req: RequestLike): string => {
  if (isFromCloudflare(req)) {
    const header = req.headers['cf-connecting-ip'];
    const connecting = Array.isArray(header) ? header[0] : header;
    if (connecting && net.isIP(connecting.trim())) {
      return connecting.trim();
    }
  }
  return req.ip ?? '';
};
