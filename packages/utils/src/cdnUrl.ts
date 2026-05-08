// Returns the CDN base URL configured for the current process / page render.
// Server: read from process.env.CDN_BASE_URL.
// Client: read from window.reactProps.cdnBaseUrl, populated by render.ts.
// In dev (and when unset) this is empty, so cdnUrl returns same-origin paths
// and Express keeps serving from packages/server/public/ as it always has.
const getBase = (): string => {
  if (typeof window !== 'undefined') {
    const fromProps = (window as unknown as { reactProps?: { cdnBaseUrl?: string } }).reactProps?.cdnBaseUrl;
    if (typeof fromProps === 'string') return fromProps;
  }
  if (typeof process !== 'undefined' && process.env && typeof process.env.CDN_BASE_URL === 'string') {
    return process.env.CDN_BASE_URL;
  }
  return '';
};

export const cdnUrl = (path: string): string => {
  const base = getBase();
  if (!base) return path;
  const trimmedBase = base.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${suffix}`;
};

export default cdnUrl;
