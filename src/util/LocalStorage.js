export function get(key) {
  if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
  }
}

export function set(key, value) {
  if (typeof localStorage !== 'undefined') {
      return localStorage.setItem(key, value);
  }
}

export default { get, set }