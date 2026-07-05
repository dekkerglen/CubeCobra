// Global client-side error capture. Installs window `error` / `unhandledrejection`
// listeners (and is called directly by our React ErrorBoundary), batches reports,
// and POSTs them to /api/clienterror where the server buffers and flushes to
// CloudWatch. Everything here is best-effort and must never throw into app code.

const ENDPOINT = '/api/clienterror';

// Client-side batching: coalesce bursts into one request, but flush promptly.
const MAX_BATCH = 10;
const FLUSH_DELAY_MS = 2000;
// Cap total reports per page load so a render loop can't hammer the endpoint.
const MAX_REPORTS_PER_SESSION = 50;

export type ClientErrorKind = 'onerror' | 'unhandledrejection' | 'react-boundary';

export interface ClientErrorPayload {
  message: string;
  kind: ClientErrorKind;
  stack?: string;
  componentStack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  url?: string;
  userAgent?: string;
  clientTimestamp?: number;
}

let queue: ClientErrorPayload[] = [];
let sent = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;
// De-dupe identical repeated errors (common with render loops / repeated rejections).
const seen = new Set<string>();

const csrfToken = (): string => {
  try {
    return (window as any).reactProps?.csrfToken ?? '';
  } catch {
    return '';
  }
};

// Cross-origin script errors surface as an opaque "Script error." with no useful
// detail; browser-extension noise and the benign ResizeObserver loop warning are
// not actionable. Drop them so they don't drown out real bugs.
const shouldIgnore = (payload: ClientErrorPayload): boolean => {
  const msg = payload.message || '';
  if (!msg) return true;
  if (msg === 'Script error.' || msg === 'Script error') return true;
  if (msg.startsWith('ResizeObserver loop')) return true;
  if ((payload.source || '').startsWith('chrome-extension://')) return true;
  if ((payload.source || '').startsWith('moz-extension://')) return true;
  return false;
};

const dedupeKey = (p: ClientErrorPayload): string =>
  `${p.kind}|${p.message}|${p.source ?? ''}:${p.lineno ?? ''}:${p.colno ?? ''}`;

const flush = (useBeacon = false): void => {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;

  const batch = queue;
  queue = [];
  const body = JSON.stringify({ errors: batch });

  try {
    // On page unload, sendBeacon is the only reliable transport.
    if (useBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      return;
    }

    // keepalive lets the request outlive a navigation triggered right after the error.
    fetch(ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken(),
      },
      body,
    }).catch(() => {
      // Swallow: reporting failures must not generate more reports.
    });
  } catch {
    // Swallow.
  }
};

const scheduleFlush = (): void => {
  if (flushTimer === null) {
    flushTimer = setTimeout(() => flush(false), FLUSH_DELAY_MS);
  }
};

const enqueue = (payload: ClientErrorPayload): void => {
  if (sent >= MAX_REPORTS_PER_SESSION) return;
  if (shouldIgnore(payload)) return;

  const key = dedupeKey(payload);
  if (seen.has(key)) return;
  seen.add(key);

  queue.push({
    ...payload,
    url: payload.url ?? (typeof window !== 'undefined' ? window.location.href : undefined),
    userAgent: payload.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
    clientTimestamp: payload.clientTimestamp ?? Date.now(),
  });
  sent += 1;

  if (queue.length >= MAX_BATCH) {
    flush(false);
  } else {
    scheduleFlush();
  }
};

// Public: report an error caught by our React ErrorBoundary (or anywhere in app code).
export const reportError = (payload: ClientErrorPayload): void => {
  try {
    enqueue(payload);
  } catch {
    // Never let reporting break the caller.
  }
};

// Install global handlers. Idempotent and browser-only.
export const initErrorReporting = (): void => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    // Resource-load failures (img/script) also fire 'error' but have no `.error`
    // and no message — ignore those, we only want script exceptions.
    if (!event.error && !event.message) return;
    reportError({
      kind: 'onerror',
      message: event.message || (event.error && event.error.message) || 'Unknown error',
      stack: event.error?.stack,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason: any = event.reason;
    reportError({
      kind: 'unhandledrejection',
      message: (reason && (reason.message || String(reason))) || 'Unhandled promise rejection',
      stack: reason && reason.stack,
    });
  });

  // Best-effort flush of anything queued when the page is going away.
  window.addEventListener('pagehide', () => flush(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });
};
