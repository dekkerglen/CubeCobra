// Request bodies and URLs are written to CloudWatch for every request, so anything that
// grants access has to be removed first: passwords (password, password2, password3, …),
// API keys sent by our own services, share tokens, reset codes and captcha responses.
const SENSITIVE_KEY = /^pass(word)?\d*$|secret|token|api[-_]?key|^code$|captcha|authorization|^email$/i;

const MAX_DEPTH = 5;

const sanitizeValue = (value: any, depth: number): any => {
  if (!value || typeof value !== 'object' || depth > MAX_DEPTH) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }
  const sanitized: Record<string, any> = {};
  for (const [key, inner] of Object.entries(value)) {
    if (!SENSITIVE_KEY.test(key)) {
      sanitized[key] = sanitizeValue(inner, depth + 1);
    }
  }
  return sanitized;
};

/** Returns a copy of a request body with credential-like fields removed, at any depth. */
export const sanitizeHttpBody = (body?: Record<string, any>): Record<string, any> | undefined => {
  if (!body) {
    return body;
  }
  return sanitizeValue(body, 0);
};

// Routes whose path itself carries a secret (reset codes, verification tokens).
const SECRET_PATH_PREFIXES = ['/user/passwordreset/', '/user/register/confirm/', '/user/confirmemailchange/'];

/**
 * A URL that is safe to log: the query string is dropped (share tokens and API keys travel
 * there) and secret-bearing path segments are masked.
 */
export const sanitizeUrl = (url?: string): string | undefined => {
  if (!url) {
    return url;
  }
  const path = url.split('?')[0]!;
  const prefix = SECRET_PATH_PREFIXES.find((candidate) => path.toLowerCase().startsWith(candidate));
  return prefix ? `${path.slice(0, prefix.length)}[redacted]` : path;
};
