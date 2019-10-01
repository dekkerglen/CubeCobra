function changeQuery(params) {
  const str = params.toString();
  if (str) {
    window.history.replaceState({}, document.title, window.location.pathname + '?' + str + window.location.hash);
  } else {
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }
}

export function get(key, def) {
  const params = new URLSearchParams(window.location.search.slice(1));
  const result = params.get(key);
  return result === null ? def : result;
}

export function set(key, value) {
  const params = new URLSearchParams(window.location.search.slice(1));
  params.set(key, value);
  changeQuery(params);
}

export function del(key) {
  const params = new URLSearchParams(window.location.search.slice(1));
  params.delete(key);
  changeQuery(params);
}

export default { get, set, del };