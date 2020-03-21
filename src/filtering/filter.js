import nearley from 'nearley';

import filterCardGrammar from 'generated/filtering/cardFilters';

const ALL_OPERATORS = [':', '=', '!=', '<>', '<', '<=', '>', '>='];

export const operatorsRegex = new RegExp(`(?:${ALL_OPERATORS.join('|')})`);

export const filterUses = (filter, name) => filter.fieldsUsed.findIndex(name) >= 0;

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

  const filterParser = new nearley.Parser(nearley.Grammar.fromCompiled(filterCardGrammar));
  filterParser.feed(filterText);
  const { results } = filterParser;
  if (results.length === 1) {
    const [filter] = results;
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
