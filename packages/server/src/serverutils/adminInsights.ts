// Shared helpers for the admin Errors / Client Errors / Performance dashboards.

// Allowed look-back windows in minutes, guarded so the client can't request an arbitrary
// (expensive) range.
export const WINDOW_MINUTES = new Set([60, 180, 720, 1440, 4320, 10080]);

export const clampWindow = (requested: unknown, fallback: number): number => {
  const value = Number(requested);
  return WINDOW_MINUTES.has(value) ? value : fallback;
};

// Replaces variable tokens (quoted subjects, ids, numbers) with placeholders so errors
// differing only by their subject collapse together.
const normalizeTokens = (s: string): string =>
  s
    .replace(/"[^"]*"/g, '"<str>"')
    .replace(/'[^']*'/g, "'<str>'")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\b[0-9a-f]{24}\b/gi, '<id>')
    .replace(/\b[0-9a-f]{12,}\b/gi, '<hex>')
    .replace(/\b\d+\b/g, '<n>');

// A generic wrapper prefix that carries no information on its own — every unhandled
// rejection is logged with this identical first line, so we skip past it to the real cause.
const GENERIC_PREFIX = /^Unhandled Rejection at: Promise/i;

// Matches an app-code stack frame, capturing the source path (after src/) and line number,
// e.g. `.../dist/server/src/router/routes/cube.js:123:88` -> `cube.js`, `123`.
const APP_FRAME = /\/dist\/server\/src\/([^\s:()]+):(\d+):\d+/;

/**
 * Turns a raw (often multi-line) error log entry into:
 *  - `readable`: the meaningful message line plus the originating app frame (file:line),
 *    for display — so "Unhandled Rejection at: Promise" becomes the actual error + location.
 *  - `signature`: the same with variable tokens normalized, for aggregation. The app frame
 *    is preserved verbatim so errors sharing a wrapper message but thrown from different
 *    handlers stay distinct.
 */
export const summarizeError = (raw: string): { readable: string; signature: string } => {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // The first line that isn't the generic unhandled-rejection prefix is the real message.
  const messageLine = lines.find((l) => !GENERIC_PREFIX.test(l)) || lines[0] || '';

  // The deepest app frame (bottom of the stack) is the handler the error originated in.
  let frame = '';
  for (const line of lines) {
    const match = line.match(APP_FRAME);
    if (match) {
      const path = match[1] ?? '';
      const file = path.split('/').pop() || path;
      frame = `${file}:${match[2] ?? ''}`;
    }
  }

  const suffix = frame ? ` @ ${frame}` : '';
  const readable = `${messageLine}${suffix}`.slice(0, 500);
  const signature = (normalizeTokens(messageLine) + suffix).trim().slice(0, 300) || '(empty)';
  return { readable, signature };
};

/**
 * The aggregation signature for an error message. See summarizeError.
 */
export const normalizeErrorMessage = (raw: string): string => summarizeError(raw).signature;

export interface ParsedError {
  signature: string;
  readable: string;
  errorType?: string;
  handler?: string;
  location?: string;
  method?: string;
  path?: string;
  authenticated?: boolean;
  username?: string | null;
  unhandledRejection?: boolean;
  stack?: string;
}

/**
 * Parses a raw error log entry. New entries are structured JSON records (see
 * serverutils/errorLog.ts) — we key the signature on `errorType + location` and surface
 * the handler, request context, and stack for triage. Pre-existing text-blob entries fall
 * back to summarizeError, so both formats display side by side during the transition.
 */
export const parseErrorEntry = (raw: string): ParsedError => {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const rec = JSON.parse(trimmed);
      if (rec && typeof rec === 'object' && (rec.level === 'error' || rec.errorType || rec.stack || rec.message)) {
        const message = String(rec.message ?? '');
        const errorType = rec.errorType ? String(rec.errorType) : undefined;
        const handler = rec.handler ? String(rec.handler) : undefined;
        const location = rec.location ? String(rec.location) : undefined;
        const anchor = location || handler || '';
        const signature =
          `${errorType ? `${errorType}: ` : ''}${normalizeTokens(message)}${anchor ? ` @ ${anchor}` : ''}`
            .trim()
            .slice(0, 300) || '(empty)';
        const readable = `${errorType ? `${errorType}: ` : ''}${message}`.slice(0, 500);
        return {
          signature,
          readable,
          errorType,
          handler,
          location,
          method: rec.method ? String(rec.method) : undefined,
          path: rec.path ? String(rec.path) : undefined,
          authenticated: typeof rec.authenticated === 'boolean' ? rec.authenticated : undefined,
          username: rec.username ?? null,
          unhandledRejection: !!rec.unhandledRejection,
          stack: rec.stack ? String(rec.stack) : undefined,
        };
      }
    } catch {
      // Not valid JSON — fall through to text parsing.
    }
  }
  const { signature, readable } = summarizeError(raw);
  return { signature, readable };
};

// True when an Insights error is just "this log group hasn't been created yet" — happens
// for the client-error group before any client error has ever been flushed. Callers
// surface this as an empty result rather than a 500.
export const isMissingLogGroup = (err: unknown): boolean =>
  err instanceof Error && /ResourceNotFoundException|does not exist/i.test(err.message);
