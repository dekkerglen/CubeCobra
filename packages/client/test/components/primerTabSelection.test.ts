import { selectedAfterMove, selectedAfterRemove } from 'components/about/primerTabSelection';

describe('selectedAfterMove', () => {
  it.each([
    { name: 'selected tab moved forward', selected: 1, from: 1, to: 3, expected: 3 },
    { name: 'selected tab moved back', selected: 3, from: 3, to: 0, expected: 0 },
    { name: 'tab moved from before to after selected', selected: 2, from: 0, to: 4, expected: 1 },
    { name: 'tab moved from before to onto selected', selected: 2, from: 0, to: 2, expected: 1 },
    { name: 'tab moved from after to before selected', selected: 2, from: 4, to: 0, expected: 3 },
    { name: 'tab moved from after to onto selected', selected: 2, from: 4, to: 2, expected: 3 },
    { name: 'move entirely before selected', selected: 4, from: 0, to: 2, expected: 4 },
    { name: 'move entirely after selected', selected: 0, from: 2, to: 4, expected: 0 },
  ])('$name', ({ selected, from, to, expected }) => {
    expect(selectedAfterMove(selected, from, to)).toBe(expected);
  });
});

describe('selectedAfterRemove', () => {
  it.each([
    { name: 'removed before selected', selected: 2, removed: 0, newLength: 3, expected: 1 },
    { name: 'selected is last and removed', selected: 2, removed: 2, newLength: 2, expected: 1 },
    { name: 'selected in the middle and removed', selected: 1, removed: 1, newLength: 2, expected: 1 },
    { name: 'removed after selected', selected: 0, removed: 2, newLength: 2, expected: 0 },
    { name: 'removed down to a single tab', selected: 1, removed: 1, newLength: 1, expected: 0 },
    { name: 'first selected removed, one left', selected: 0, removed: 0, newLength: 1, expected: 0 },
  ])('$name', ({ selected, removed, newLength, expected }) => {
    expect(selectedAfterRemove(selected, removed, newLength)).toBe(expected);
  });
});
