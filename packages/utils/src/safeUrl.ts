/**
 * Returns the normalized href when `input` is an absolute http(s) URL, otherwise null.
 *
 * Use this for any user-derived value that ends up in an `href` or `src`: React renders
 * `javascript:` and `data:` URLs verbatim, so scheme checks have to happen before render.
 */
export const safeHttpUrl = (input: unknown): string | null => {
  if (typeof input !== 'string' || input.trim() === '') {
    return null;
  }
  try {
    const url = new URL(input.trim());
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href;
    }
  } catch {
    // not an absolute URL
  }
  return null;
};

/**
 * Returns a same-site relative path (e.g. "/cube/list/abc?x=1") when `input` is one,
 * otherwise null. Rejects protocol-relative ("//host") and backslash ("/\host") forms that
 * browsers resolve to another origin.
 */
export const safeRelativePath = (input: unknown): string | null => {
  if (typeof input !== 'string' || !input.startsWith('/')) {
    return null;
  }
  if (input.startsWith('//') || input.startsWith('/\\') || /[\r\n]/.test(input)) {
    return null;
  }
  return input;
};
