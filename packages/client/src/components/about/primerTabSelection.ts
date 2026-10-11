export const selectedAfterMove = (selected: number, from: number, to: number): number => {
  if (selected === from) {
    return to;
  }
  if (from < selected && to >= selected) {
    return selected - 1;
  }
  if (from > selected && to <= selected) {
    return selected + 1;
  }
  return selected;
};

export const selectedAfterRemove = (selected: number, removed: number, newLength: number): number =>
  removed < selected ? selected - 1 : Math.min(selected, newLength - 1);
