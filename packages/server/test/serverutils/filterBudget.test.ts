import { makeFilter } from '@utils/filtering/FilterCards';

import { budgetRegexFilter, FilterTimeoutError, REGEX_FILTER_BUDGET_MS } from '../../src/serverutils/filterBudget';
import { createCard } from '../test-utils/data';

describe('budgetRegexFilter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns filters without regex unchanged', () => {
    const { filter } = makeFilter('t:creature');
    expect(budgetRegexFilter(filter)).toBe(filter);
    expect(budgetRegexFilter(null)).toBeNull();
  });

  it('keeps the filter properties searches read', () => {
    const { filter } = makeFilter('o:/draw/ t:instant');
    const budgeted = budgetRegexFilter(filter)!;
    expect(budgeted).not.toBe(filter);
    expect(budgeted.fieldsUsed).toEqual(filter!.fieldsUsed);
    expect(budgeted.regexes).toEqual(['draw']);
  });

  it('gives up once the budget is spent', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    const budgeted = budgetRegexFilter(makeFilter('o:/draw/').filter)!;
    const cards = Array.from({ length: 1000 }, () => createCard());
    expect(() => cards.filter(budgeted)).not.toThrow();
    now.mockReturnValue(REGEX_FILTER_BUDGET_MS + 1);
    expect(() => cards.filter(budgeted)).toThrow(FilterTimeoutError);
  });
});
