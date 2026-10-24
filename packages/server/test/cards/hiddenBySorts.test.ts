import { countCardsHiddenBySorts } from '@utils/sorting/Sort';

import { createCard, createCardDetails } from '../test-utils/data';

const tagged = (name: string, tags: string[]) => createCard({ tags, details: createCardDetails({ name }) });

describe('countCardsHiddenBySorts', () => {
  it('counts cards that fall in no group for a sort', () => {
    const cards = [tagged('A', ['Removal']), tagged('B', []), tagged('C', [])];
    expect(countCardsHiddenBySorts(cards, ['Tags', 'Unsorted', 'Unsorted'])).toBe(2);
  });

  it('is zero when every card has a group', () => {
    const cards = [tagged('A', ['Removal']), tagged('B', ['Ramp'])];
    expect(countCardsHiddenBySorts(cards, ['Tags', 'Unsorted', 'Unsorted'])).toBe(0);
  });

  it('counts a card once even when it fits several groups', () => {
    const cards = [tagged('A', ['Removal', 'Ramp']), tagged('B', [])];
    expect(countCardsHiddenBySorts(cards, ['Tags', 'Unsorted', 'Unsorted'])).toBe(1);
  });

  it('counts cards hidden by a later sort level', () => {
    const cards = [tagged('A', ['Removal']), tagged('B', [])];
    expect(countCardsHiddenBySorts(cards, ['Unsorted', 'Unsorted', 'Tags'])).toBe(1);
  });

  it('is zero for an empty list', () => {
    expect(countCardsHiddenBySorts([], ['Tags', 'Unsorted', 'Unsorted'])).toBe(0);
  });
});
