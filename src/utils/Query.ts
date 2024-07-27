import URLSearchParams from 'core-js-pure/features/url-search-params';

function query(): string {
  return typeof window !== 'undefined' ? window.location.search.slice(1) : '';
}

function changeQuery(params: URLSearchParams): void {
  if (typeof window === 'undefined') {
    return;
  }
  const str = params.toString();
  if (str) {
    window.history.replaceState({}, document.title, `${window.location.pathname}?${str}${window.location.hash}`);
  } else {
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }
}

function get(key: string, def: string): string {
  const params = new URLSearchParams(query());
  const result = params.get(key);
  return result === null ? def : result;
}

function set(key: string, value: string): void {
  const params = new URLSearchParams(query());
  params.set(key, value);
  changeQuery(params);
}

function del(key: string): void {
  const params = new URLSearchParams(query());
  params.delete(key);
  changeQuery(params);
}

export default { get, set, del };
