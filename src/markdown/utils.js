export function add(data, field, value) {
  if (data[field]) data[field].push(value);
  else data[field] = [value];
}

export default {
  add,
};
