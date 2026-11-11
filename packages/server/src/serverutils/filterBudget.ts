import Card from '@utils/datatypes/Card';
import { FilterFunction, filterUsesRegex } from '@utils/filtering/FilterCards';

// How long a filter that uses /regex/ may run over the catalog before the request gives up.
export const REGEX_FILTER_BUDGET_MS = 2000;

export class FilterTimeoutError extends Error {
  constructor() {
    super('Search took too long');
  }
}

// Regex clauses can't hang (they run on RE2), but a heavy one over the whole catalog still costs real CPU, so a
// filter that uses them throws FilterTimeoutError once its budget is spent, checking every 256 cards. Wrap the filter
// right before running it. Filters without regex are returned as they are.
export const budgetRegexFilter = (filter: FilterFunction | null): FilterFunction | null => {
  if (!filter || !filterUsesRegex(filter)) {
    return filter;
  }
  const deadline = Date.now() + REGEX_FILTER_BUDGET_MS;
  let calls = 0;
  const budgeted = (card: Card): boolean => {
    calls += 1;
    if (calls % 256 === 0 && Date.now() > deadline) {
      throw new FilterTimeoutError();
    }
    return filter(card);
  };
  return Object.assign(budgeted, {
    fieldsUsed: filter.fieldsUsed,
    stringify: filter.stringify,
    describe: filter.describe,
    regexes: filter.regexes,
  });
};
