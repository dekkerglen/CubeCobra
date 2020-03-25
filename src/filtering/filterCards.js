import { Grammar, Parser } from 'nearley';

import filterCardGrammar from 'generated/filtering/cardFilters';

const compiledGrammar = Grammar.fromCompiled(filterCardGrammar);

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

  const filterParser = new Parser(compiledGrammar);
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
