import dns from 'dns';
import http from 'http';
import https from 'https';
import net from 'net';
import zlib from 'zlib';

/**
 * Outbound HTTP for URLs that came from users (custom card images, podcast feeds).
 *
 * Plain `fetch` will happily follow a user-supplied URL to the instance metadata service,
 * the internal recommender ALB or localhost, buffer an unbounded body and transparently
 * inflate a gzip bomb. This helper:
 *   - only speaks http(s) on the standard ports,
 *   - resolves the hostname itself and refuses private, loopback, link-local, CGNAT,
 *     multicast and other non-public ranges (checked on every hop, and the connection is
 *     pinned to the address that was checked, so DNS rebinding can't swap it afterwards),
 *   - follows a small number of redirects, re-validating each one,
 *   - enforces a total timeout and a cap on the (decompressed) body size.
 */

export class SafeFetchError extends Error {}

// Separate lists per family: net.BlockList also matches IPv4 addresses against IPv4-mapped
// IPv6 rules, so a single list holding ::ffff:0:0/96 would block every IPv4 address.
const blockedV4 = new net.BlockList();
const blockedV6 = new net.BlockList();
const ipv4Mapped = new net.BlockList();
ipv4Mapped.addSubnet('::ffff:0:0', 96, 'ipv6');

const BLOCKED_V4: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const BLOCKED_V6: [string, number][] = [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
];

for (const [address, prefix] of BLOCKED_V4) blockedV4.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of BLOCKED_V6) blockedV6.addSubnet(address, prefix, 'ipv6');

/** True when `ip` is a literal address in public unicast space. */
export const isPublicAddress = (ip: string): boolean => {
  const family = net.isIP(ip);
  if (family === 4) {
    return !blockedV4.check(ip, 'ipv4');
  }
  if (family === 6) {
    // IPv4-mapped IPv6 addresses are refused outright rather than unwrapped.
    return !ipv4Mapped.check(ip, 'ipv6') && !blockedV6.check(ip, 'ipv6');
  }
  return false;
};

type LookupCallback = (err: NodeJS.ErrnoException | null, address: any, family?: number) => void;

/** A dns.lookup replacement that refuses to hand non-public addresses to the socket. */
const publicOnlyLookup = (hostname: string, options: any, callback: LookupCallback): void => {
  const opts = typeof options === 'object' && options !== null ? options : {};
  dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
    if (err) {
      callback(err, undefined);
      return;
    }
    const list = addresses as unknown as dns.LookupAddress[];
    if (list.length === 0 || list.some((entry) => !isPublicAddress(entry.address))) {
      callback(
        Object.assign(new SafeFetchError(`Refusing to connect to non-public address for ${hostname}`), {
          code: 'ENOTPUBLIC',
        }),
        undefined,
      );
      return;
    }
    if (opts.all) {
      callback(null, list);
    } else {
      callback(null, list[0]!.address, list[0]!.family);
    }
  });
};

export interface SafeFetchOptions {
  /** Maximum number of body bytes accepted, after decompression. Default 5 MB. */
  maxBytes?: number;
  /** Total time budget for the whole request, including redirects. Default 10 s. */
  timeoutMs?: number;
  /** Redirects to follow (each one re-validated). Default 3. */
  maxRedirects?: number;
  headers?: Record<string, string>;
}

export interface SafeFetchResult {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  url: string;
}

const ALLOWED_PORTS = new Set(['', '80', '443']);

/** Parses and validates a user-supplied URL; throws SafeFetchError when it isn't fetchable. */
export const parseFetchableUrl = (raw: string): URL => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SafeFetchError('Only http and https URLs are allowed');
  }
  if (url.username || url.password) {
    throw new SafeFetchError('URLs with credentials are not allowed');
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new SafeFetchError('Only the standard http and https ports are allowed');
  }
  // A bracketed IPv6 literal or a dotted IPv4 literal is checked up front; hostnames are
  // checked at connect time by publicOnlyLookup.
  const literal = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(literal) && !isPublicAddress(literal)) {
    throw new SafeFetchError('Refusing to fetch a non-public address');
  }
  return url;
};

const decompress = (res: http.IncomingMessage): NodeJS.ReadableStream => {
  const encoding = String(res.headers['content-encoding'] || '').toLowerCase();
  if (encoding === 'gzip' || encoding === 'x-gzip') return res.pipe(zlib.createGunzip());
  if (encoding === 'deflate') return res.pipe(zlib.createInflate());
  if (encoding === 'br') return res.pipe(zlib.createBrotliDecompress());
  return res;
};

const requestOnce = (
  url: URL,
  headers: Record<string, string>,
  maxBytes: number,
  signal: AbortSignal,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer; location?: string }> =>
  new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(
      url,
      {
        method: 'GET',
        headers: { 'Accept-Encoding': 'gzip, deflate, br', ...headers },
        lookup: publicOnlyLookup as any,
        signal,
        // Never reuse pooled sockets: each request must go through our lookup.
        agent: false,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          resolve({ status, headers: res.headers, body: Buffer.alloc(0), location: res.headers.location });
          return;
        }

        const declared = Number(res.headers['content-length']);
        if (Number.isFinite(declared) && declared > maxBytes) {
          res.destroy();
          reject(new SafeFetchError(`Response too large (${declared} bytes)`));
          return;
        }

        const stream = decompress(res);
        const chunks: Buffer[] = [];
        let total = 0;
        stream.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > maxBytes) {
            res.destroy();
            (stream as any).destroy?.();
            reject(new SafeFetchError(`Response exceeded ${maxBytes} bytes`));
            return;
          }
          chunks.push(chunk);
        });
        stream.on('end', () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
        stream.on('error', (err) => reject(err));
      },
    );
    req.on('error', reject);
    req.end();
  });

/**
 * GET a user-supplied URL with SSRF and resource-exhaustion protections. Resolves for any
 * HTTP status (check `status`); rejects with SafeFetchError for policy violations, or the
 * underlying error for network failures and timeouts.
 */
export const safeFetch = async (rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> => {
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxRedirects = options.maxRedirects ?? 3;
  const signal = AbortSignal.timeout(timeoutMs);

  let url = parseFetchableUrl(rawUrl);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const result = await requestOnce(url, options.headers ?? {}, maxBytes, signal);
    if (result.location === undefined) {
      return { status: result.status, headers: result.headers, body: result.body, url: url.href };
    }
    url = parseFetchableUrl(new URL(result.location, url).href);
  }
  throw new SafeFetchError('Too many redirects');
};
