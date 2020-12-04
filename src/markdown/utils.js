export function add(data, field, value) {
  if (data[field]) data[field].push(value);
  else data[field] = [value];
}

export function shallowEqual(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;

  for (const prop in a) {
    if (a[prop] !== b[prop]) return false;
  }
  return true;
}

export default {
  add,
  shallowEqual,
};
