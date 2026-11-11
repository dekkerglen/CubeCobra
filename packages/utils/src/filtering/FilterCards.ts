import Card from '@utils/datatypes/Card';
import { AllField, CardDetails } from '@utils/datatypes/Card';
import filterCardGrammar from '@utils/generated/filtering/cardFilters';
import { Grammar, Parser } from 'nearley';

// @ts-expect-error(TODO: figure this one out)
const compiledGrammar: Grammar = Grammar.fromCompiled(filterCardGrammar);

const ALL_OPERATORS: string[] = [':', '=', '!=', '<>', '<', '<=', '>', '>='];

export type FilterFunction = ((card: Card) => boolean) & {
  fieldsUsed: AllField[];
  stringify: string;
  // Plain-English ("pseudo-English") description of what the filter does, composed
  // by the grammar as the filter is parsed. See FuncOperations for the fragments.
  // Optional: real parses always set it, but manually-constructed filters may not.
  describe?: string;
  // The pattern of every /regex/ clause, composed by the grammar like fieldsUsed.
  regexes?: string[];
};

export const operatorsRegex: RegExp = new RegExp(`(?:${ALL_OPERATORS.join('|')})`);

export const filterUses = (filter: FilterFunction | null, name: AllField): boolean =>
  !!filter?.fieldsUsed.includes(name);

// True when the filter contains the "include:extras" directive. That directive
// isn't a real field, so it's tracked via the pseudo-field 'extras' rather than
// AllField; the cast keeps it out of the normal field typing.
export const filterIncludesExtras = (filter: FilterFunction | null): boolean =>
  !!filter?.fieldsUsed.includes('extras' as AllField);

export const filterUsedFields = (filter: FilterFunction | null): AllField[] => filter?.fieldsUsed ?? [];

export const filterToString = (filter: FilterFunction | null): string => filter?.stringify ?? 'empty filter';

// Renders the filter's composed `.describe` fragment into a full readable sentence,
// e.g. "Matching cards where mana value is 3 or more and color includes White."
export const filterToReadableString = (filter: FilterFunction | null): string => {
  const describe = filter?.describe?.trim();
  if (!describe) {
    return 'Matching all cards.';
  }
  return `Matching cards where ${describe}.`;
};

export function defaultFilter(): FilterFunction {
  const result: Partial<FilterFunction> = () => true;
  result.fieldsUsed = [];
  result.stringify = '';
  result.describe = '';
  return result as FilterFunction;
}

export type FilterResult = { err: any; filter: FilterFunction | null };

// Hard ceiling on filter text, as a backstop against parser blow-ups. Saved filters (draft format
// slots, custom sort categories) have never had a length limit, so this is set well above anything
// hand-written; endpoints that parse anonymous input apply the tighter MAX_SEARCH_FILTER_LENGTH.
export const MAX_FILTER_LENGTH = 4000;
export const MAX_SEARCH_FILTER_LENGTH = 1000;

// Regex clauses run on a linear-time engine, so no pattern can hang, but a long pattern with large counted repeats
// is still slow over the whole card catalog. These caps keep any one filter's regex work small; Commander
// Spellbook's queries, the largest we run, use up to 5 patterns of up to 170 characters.
export const MAX_REGEX_CLAUSES = 5;
export const MAX_REGEX_LENGTH = 200;
export const MAX_REGEX_REPEAT = 100;

export const filterUsesRegex = (filter: FilterFunction | null): boolean => (filter?.regexes?.length ?? 0) > 0;

const largestRepeat = (pattern: string): number =>
  Math.max(
    0,
    ...[...pattern.matchAll(/(?<!\\)\{(\d+)(?:,(\d*))?\}/g)].map(([, low, high]) => Math.max(+low!, +(high || 0))),
  );

const regexLimitError = (regexes: string[]): string | null => {
  if (regexes.length > MAX_REGEX_CLAUSES) {
    return `A filter can use at most ${MAX_REGEX_CLAUSES} regular expressions`;
  }
  if (regexes.some((pattern) => pattern.length > MAX_REGEX_LENGTH)) {
    return `Regular expressions can be at most ${MAX_REGEX_LENGTH} characters long`;
  }
  if (regexes.some((pattern) => largestRepeat(pattern) > MAX_REGEX_REPEAT)) {
    return `Repeat counts in regular expressions can be at most ${MAX_REGEX_REPEAT}`;
  }
  return null;
};

export function makeFilter(filterText: string): FilterResult {
  if (!filterText || filterText.trim() === '') {
    return {
      err: false,
      filter: null,
    };
  }

  if (filterText.length > MAX_FILTER_LENGTH) {
    return { err: 'Filter is too long', filter: null };
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
    if (filter) {
      filter.stringify = filterText;
      if (filter.fieldsUsed === undefined) {
        filter.fieldsUsed = [];
      }
      if (filter.describe === undefined) {
        filter.describe = '';
      }
      const regexError = regexLimitError(filter.regexes ?? []);
      if (regexError) {
        return { err: regexError, filter: null };
      }
      return {
        err: !filter,
        filter: filter as FilterFunction,
      };
    }
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
  filterIncludesExtras,
  filterUsedFields,
  filterToString,
  filterToReadableString,
  makeFilter,
  filterCardsDetails,
};
