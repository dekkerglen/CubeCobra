import { Grammar, Parser } from 'nearley';

import CardDetails, { AllField } from 'datatypes/CardDetails';
import filterCardGrammar from 'generated/filtering/cardFilters';

// @ts-expect-error(TODO: figure this one out)
const compiledGrammar: Grammar = Grammar.fromCompiled(filterCardGrammar);

const ALL_OPERATORS: string[] = [':', '=', '!=', '<>', '<', '<=', '>', '>='];

type Filter = ((details: CardDetails) => boolean) & {
  fieldsUsed: AllField[];
  stringify: string;
};

export const operatorsRegex: RegExp = new RegExp(`(?:${ALL_OPERATORS.join('|')})`);

export const filterUses = (filter: Filter | null, name: AllField): boolean => !!filter?.fieldsUsed.includes(name);

export const filterUsedFields = (filter: Filter | null): AllField[] => filter?.fieldsUsed ?? [];

export const filterToString = (filter: Filter | null): string => filter?.stringify ?? 'empty filter';

export function makeFilter(filterText: string): { err: any; filter: Filter | null } {
  if (!filterText || filterText.trim() === '') {
    return {
      err: false,
      filter: null,
    };
  }

  const filterParser: Parser = new Parser(compiledGrammar);
  try {
    filterParser.feed(filterText);
  } catch (err) {
    return { err, filter: null };
  }
  const results: any[] = filterParser.results;
  if (results.length === 1) {
    const [filter]: Partial<Filter>[] = results;
    filter.stringify = filterText;
    if (filter.fieldsUsed === undefined) {
      filter.fieldsUsed = [];
    }
    return {
      err: !filter,
      filter: filter as Filter,
    };
  }

  return {
    err: results,
    filter: null,
  };
}

export const filterCardsDetails = (cards: CardDetails[], filter: Filter): CardDetails[] =>
  filter ? cards.filter(filter) : cards;

export default {
  operators: ALL_OPERATORS,
  operatorsRegex,
  filterUses,
  filterUsedFields,
  filterToString,
  makeFilter,
  filterCardsDetails,
};
