function hash() {
  return typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
}

function changeHash(hash) {
  if (typeof window === 'undefined') {
    return;
  }
  const url = window.location.pathname + window.location.search + (hash ? `#${hash}` : '');
  window.history.replaceState({}, document.title, url);
}

export function get(key, def) {
  const params = new URLSearchParams(hash());
  const result = params.get(key);
  return result === null ? def : result;
}

export function set(key, value) {
  const params = new URLSearchParams(hash());
  params.set(key, value);
  changeHash(params.toString());
}

export function del(key) {
  const params = new URLSearchParams(hash());
  params.delete(key);
  changeHash(params.toString());
}

export default { get, set, del };
