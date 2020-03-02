import { tokenize } from 'parsing/parsingHelpers';

import FilterParser, { ALL_OPERATORS } from 'filters/filterParser';
import FilterVisitor from 'filters/filterVisitor';

export const operatorsRegex = new RegExp(`(?:${ALL_OPERATORS.join('|')})`);

// TODO: Implement
// eslint-disable-next-line no-unused-vars
export function filterUses(filters, name) {
  return true;
}

// TODO: Implement
// eslint-disable-next-line no-unused-vars
export function filterToString(filters) {
  return null;
}

export function makeFilter(filterText) {
  if (!filterText || filterText.trim() === '') {
    return {
      err: false,
      filter: null,
    };
  }

  // This is much simpler than adding it into the grammar since it would require
  // a very large lookahead to not be ambiguous.
  if (!operatorsRegex.test(filterText)) {
    filterText = `n:${filterText.replace(/ /g, ' n:')}`;
  }

  const tokens = tokenize(filterText.trim().toLowerCase());
  FilterParser.input = tokens;
  const parsed = FilterParser.parse();
  if (parsed) {
    const filter = FilterVisitor.parse(parsed);
    return {
      err: !filter,
      filter,
    };
  }

  return {
    err: true,
    filter: null,
  };
}

export default {
  operators: ALL_OPERATORS,
  operatorsRegex,
  filterUses,
  filterToString,
  makeFilter,
};
