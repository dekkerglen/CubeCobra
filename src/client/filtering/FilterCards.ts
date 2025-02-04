import { Grammar, Parser } from 'nearley';

import Card from '../../datatypes/Card';
import { AllField, CardDetails } from '../../datatypes/Card';
import filterCardGrammar from '../generated/filtering/cardFilters';

// @ts-expect-error(TODO: figure this one out)
const compiledGrammar: Grammar = Grammar.fromCompiled(filterCardGrammar);

const ALL_OPERATORS: string[] = [':', '=', '!=', '<>', '<', '<=', '>', '>='];

export type FilterFunction = ((card: Card) => boolean) & {
  fieldsUsed: AllField[];
  stringify: string;
};

export const operatorsRegex: RegExp = new RegExp(`(?:${ALL_OPERATORS.join('|')})`);

export const filterUses = (filter: FilterFunction | null, name: AllField): boolean =>
  !!filter?.fieldsUsed.includes(name);

export const filterUsedFields = (filter: FilterFunction | null): AllField[] => filter?.fieldsUsed ?? [];

export const filterToString = (filter: FilterFunction | null): string => filter?.stringify ?? 'empty filter';

export function defaultFilter(): FilterFunction {
  const result: Partial<FilterFunction> = () => true;
  result.fieldsUsed = [];
  result.stringify = '';
  return result as FilterFunction;
}

export function makeFilter(filterText: string): { err: any; filter: FilterFunction | null } {
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
    const [filter]: Partial<FilterFunction>[] = results;
    filter.stringify = filterText;
    if (filter.fieldsUsed === undefined) {
      filter.fieldsUsed = [];
    }
    return {
      err: !filter,
      filter: filter as FilterFunction,
    };
  }

  return {
    err: results,
    filter: null,
  };
}

export const filterCardsDetails = (cards: CardDetails[], filter: FilterFunction): CardDetails[] =>
  filter ? cards.filter((details) => filter({ details } as Card)) : cards;

export default {
  operators: ALL_OPERATORS,
  operatorsRegex,
  filterUses,
  filterUsedFields,
  filterToString,
  makeFilter,
  filterCardsDetails,
};
