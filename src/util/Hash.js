export function get(key, def) {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const result = params.get(key);
  return result === null ? def : result;
}

export function set(key, value) {
  const params = new URLSearchParams(window.location.hash.slice(1));
  params.set(key, value);
  window.location.hash = params.toString();
}

export function del(key) {
  const params = new URLSearchParams(window.location.hash.slice(1));
  params.del(key);
  window.location.hash = params.toString();
}

export default { get, set, del };