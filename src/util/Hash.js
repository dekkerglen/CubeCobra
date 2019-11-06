function changeHash(hash) {
  const url =  window.location.pathname + window.location.search + (hash ? `#${hash}` : '');
  window.history.replaceState({}, document.title, url);
}

export function get(key, def) {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const result = params.get(key);
  return result === null ? def : result;
}

export function set(key, value) {
  const params = new URLSearchParams(window.location.hash.slice(1));
  params.set(key, value);
  changeHash(params.toString());
}

export function del(key) {
  const params = new URLSearchParams(window.location.hash.slice(1));
  params.delete(key);
  changeHash(params.toString());
}

export default { get, set, del };
