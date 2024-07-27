import URLSearchParams from 'core-js-pure/features/url-search-params';

function hash(): string {
  return typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
}

function changeHash(newHash: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  const url = window.location.pathname + window.location.search + (newHash ? `#${newHash}` : '');
  window.history.replaceState({}, document.title, url);
}

function get(key: string, def: string): string {
  const params = new URLSearchParams(hash());
  const result = params.get(key);
  return result === null ? def : result;
}

function set(key: string, value: string): void {
  const params = new URLSearchParams(hash());
  params.set(key, value);
  changeHash(params.toString());
}

function del(key: string): void {
  const params = new URLSearchParams(hash());
  params.delete(key);
  changeHash(params.toString());
}

export default { get, set, del };
