function query(): string {
  return typeof window !== 'undefined' ? window.location.search.slice(1) : '';
}

function changeQuery(params: URLSearchParams, push = false): void {
  if (typeof window === 'undefined') {
    return;
  }
  const str = params.toString();
  const url = str
    ? `${window.location.pathname}?${str}${window.location.hash}`
    : window.location.pathname + window.location.hash;
  if (push) {
    window.history.pushState({}, document.title, url);
  } else {
    window.history.replaceState({}, document.title, url);
  }
}

function get(key: string): string | null;
function get(key: string, def: string): string;
function get(key: string, def?: string): string | null {
  const params = new URLSearchParams(query());
  const result = params.get(key);
  return result === null && def !== undefined ? def : result;
}

function set(key: string, value: string, push = false): void {
  const params = new URLSearchParams(query());
  params.set(key, value);
  changeQuery(params, push);
}

/**
 * Apply several changes with a single history entry. A null value removes the key.
 *
 * Writing params one at a time means one history call each, so a single action that changes
 * two of them (a search that also changes the sort) pushed an entry for an intermediate url
 * that never described anything the user saw. Nothing is written when the result would leave
 * the query string unchanged.
 */
function setMany(updates: Record<string, string | null>, push = false): void {
  const params = new URLSearchParams(query());
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }
  // Compare both sides normalized, so re-encoding alone (%20 vs +) isn't treated as a change.
  if (params.toString() === new URLSearchParams(query()).toString()) {
    return;
  }
  changeQuery(params, push);
}

function del(key: string, push = false): void {
  const params = new URLSearchParams(query());
  params.delete(key);
  changeQuery(params, push);
}

export default { get, set, setMany, del };
