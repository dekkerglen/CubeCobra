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
  // Git commit of the running frontend bundle (from reactProps). May differ from the
  // server version the endpoint stamps on — that gap identifies stale (cached-tab) bundles.
  clientVersion?: string;
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

const clientVersion = (): string | undefined => {
  try {
    return (window as any).reactProps?.version;
  } catch {
    return undefined;
  }
};

// The overwhelming majority of what reaches these handlers is not our code: ad SDKs
// (Nitropay, 33Across, mraid), browser extensions (crypto wallets, userscripts),
// headless bots without a real canvas, and expected fetch aborts when a user
// navigates away. We drop all of that so real CubeCobra bugs aren't buried.

// Ad networks, extensions, and injected wallet globals — matched against message,
// source, and stack (CORS-enabled ad scripts send us full stacks).
// `webkit-masked-url:` is how Safari masks the URL of an injected content script /
// extension, so any stack referencing it is third-party code, not ours.
const THIRD_PARTY_RE =
  /nitropay|33across|mraid\.js|user-script|chrome-extension:|moz-extension:|safari-extension:|webkit-masked-url:|window\.ethereum|selectedAddress|web3|id5-sync|doubleclick|googlesyndication|securepubads|googletag|gpt\.js|btloader|ad\.gt|p7cloud|setupInPageTaxonomy|amazon-adsystem|adnxs|adsystem|prebid|pubmatic|rubiconproject|criteo|sonobi|openx|sharethrough|confiant/i;

// Expected network/abort churn — user navigated away or went offline, not bugs.
// (Chunk-load failures here are from third-party bundles; ours are on assets.cubecobra.com.)
// "Unexpected token '<'" is a stale-tab artifact: after a deploy an old chunk path
// 404s, the server returns the HTML 404 page, and the browser parses `<` as JS.
const IGNORED_MESSAGE_RE =
  /^(Load failed|Failed to fetch|NetworkError when attempting to fetch|Fetch is aborted|The user aborted|The operation was aborted|AbortError|signal is aborted without reason|status -> 0|The I\/O read operation failed|NotReadableError|Loading chunk \d+ failed|The play\(\) request was interrupted|The fetching process for the media resource was aborted|Media resource .* could not be decoded|(Uncaught )?(SyntaxError: )?(Unexpected token '<'|expected expression, got '<'))/i;

// Headless/automation browsers stub out canvas/audio and generate spurious errors.
const BOT_UA_RE = /Lightpanda|HeadlessChrome|PhantomJS|puppeteer|bot\b|crawler|spider/i;

// Our first-party origin (pages on cubecobra.com, bundles on assets.cubecobra.com).
// Match on the URL's *host*, not a substring: ad wrappers embed our URL in their
// query (e.g. `https://silo60.p7cloud.net/as1.js?uri=https://cubecobra.com/...`), so a
// naive substring test would misread third-party scripts as first-party.
const isFirstPartyHost = (host: string): boolean => /(^|\.)cubecobra\.com$/i.test(host);

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

const pathOf = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
};

// Whether a string (a single URL, or a stack full of frame URLs) references any
// first-party script host. Parsing each URL ignores query/hash that may carry other URLs.
const referencesFirstParty = (text: string): boolean =>
  (text.match(/https?:\/\/[^\s)'"]+/g) || []).some((u) => isFirstPartyHost(hostOf(u)));

// Cross-origin script errors surface as an opaque "Script error." with no useful
// detail; the ResizeObserver loop warning is benign. Everything else is filtered
// by the rules above.
const shouldIgnore = (payload: ClientErrorPayload): boolean => {
  const msg = payload.message || '';
  const source = payload.source || '';
  const stack = payload.stack || '';

  if (!msg) return true;
  if (msg === 'Script error.' || msg === 'Script error') return true;
  if (msg.startsWith('ResizeObserver loop')) return true;
  if (IGNORED_MESSAGE_RE.test(msg)) return true;
  if (THIRD_PARTY_RE.test(msg) || THIRD_PARTY_RE.test(source) || THIRD_PARTY_RE.test(stack)) return true;

  // Content-free promise rejections — ad SDKs and aborted work commonly reject with
  // null or a bare {}. With no message and no first-party frame there's nothing
  // actionable. (Some come with a minified stack that carries no URL at all, e.g.
  // `Ti@` — still third-party, so we only keep these if the stack points at our code.)
  if (
    payload.kind === 'unhandledrejection' &&
    (msg === 'Unhandled promise rejection' ||
      msg === '{}' ||
      msg === '[object Object]' ||
      // Media elements reject with a bare Event (serialized as `{"isTrusted":true}`)
      // when playback is aborted/interrupted — expected, not a bug.
      /^\{"isTrusted":(true|false)\}$/.test(msg)) &&
    !referencesFirstParty(stack)
  ) {
    return true;
  }
  if (typeof navigator !== 'undefined' && BOT_UA_RE.test(navigator.userAgent)) return true;

  // Ad-network iframe getter loops (e.g. GPT overriding HTMLIFrameElement) blow the
  // stack with frames that carry no source URL — catch them by shape.
  if (/Maximum call stack/i.test(msg) && /HTMLIFrameElement/.test(stack)) return true;

  // The script that threw is a non-first-party URL — third-party code (ad SDK,
  // prebid, extension). onerror gives us `source`; our own errors are on
  // cubecobra.com / assets.cubecobra.com. (react-boundary errors carry no source.)
  if (source && /^https?:\/\//.test(source) && !isFirstPartyHost(hostOf(source))) return true;

  // Ad/consent partners inject inline <script>s into our HTML, so their errors report
  // the *page* URL as their source (e.g. `https://cubecobra.com/cube/list/foo:1:135`,
  // or a taxonomy/og:type snippet at line 1). All of our real client code ships in
  // `.js` bundles, so a first-party onerror whose source isn't a .js file is an
  // injected third-party snippet, not ours. (react-boundary errors have no source.)
  if (
    payload.kind === 'onerror' &&
    source &&
    /^https?:\/\//.test(source) &&
    isFirstPartyHost(hostOf(source)) &&
    !/\.js(\?|#|$)/i.test(pathOf(source))
  ) {
    return true;
  }

  // A stack that references remote scripts but none of ours is third-party code.
  if (stack && /https?:\/\//.test(stack) && !referencesFirstParty(stack) && !referencesFirstParty(source)) {
    return true;
  }

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
    clientVersion: payload.clientVersion ?? clientVersion(),
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

    // Serialize the rejection reason into a useful message. Bare objects would
    // otherwise stringify to "[object Object]" and lose all detail.
    let message: string;
    if (reason instanceof Error) {
      message = reason.message || reason.name || 'Error';
    } else if (typeof reason === 'string') {
      message = reason;
    } else if (reason == null) {
      message = 'Unhandled promise rejection';
    } else {
      try {
        message = JSON.stringify(reason);
      } catch {
        message = String(reason);
      }
    }

    reportError({
      kind: 'unhandledrejection',
      message,
      stack: reason && reason.stack,
    });
  });

  // Best-effort flush of anything queued when the page is going away.
  window.addEventListener('pagehide', () => flush(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });
};
