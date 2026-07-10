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

function del(key: string, push = false): void {
  const params = new URLSearchParams(query());
  params.delete(key);
  changeQuery(params, push);
}

export default { get, set, del };
