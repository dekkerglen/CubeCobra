export function arraysEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function fromEntries(entries) {
  const obj = {};
  for (const [k, v] of entries) {
    obj[k] = v;
  }
  return obj;
}

export default { arraysEqual, fromEntries };