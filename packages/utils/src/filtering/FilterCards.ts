import Card from '@utils/datatypes/Card';
import { AllField, CardDetails, PrintingPreference } from '@utils/datatypes/Card';
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
  // Terms that couldn't be parsed and were left out, as Scryfall does, e.g. ["lang:xx"]. See makeFilter.
  ignored?: string[];
  // Search directives (unique:, order:, direction:, prefer:), applied by card search. See searchDirectives.
  directives?: SearchDirectives;
  // Set by the grammar on a term that doesn't take part in matching (a directive or an ignored term).
  neutral?: boolean;
};

export interface SearchDirectives {
  unique?: 'cards' | 'prints';
  order?: string;
  direction?: 'ascending' | 'descending';
  prefer?: PrintingPreference;
}

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
  const ignored = filter?.ignored?.length ? ` Ignored ${filter.ignored.map((term) => `"${term}"`).join(', ')}.` : '';
  if (!describe) {
    return `Matching all cards.${ignored}`;
  }
  return `Matching cards where ${describe}.${ignored}`;
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

// What the grammar reads as a term that matches everything (ignoredCondition in cardFilters.ne). Characters nobody
// types, so it can't clash with a real term.
const IGNORED_PLACEHOLDER = '⦃⦄';
const MAX_IGNORED_TERMS = 20;
// Only keyword terms (lang:xx, frame>2015, -wm:orzhov) and Scryfall's @@ shortcut are left out. A malformed name or
// quote is still an error.
const IGNORABLE_TERM = /^(-?[a-z_]+(:|=|!=|<>|<=|>=|<|>)|@@$)/i;

// The whitespace-separated term around position `at`, keeping quoted text and /regexes/ whole and leaving out
// grouping parentheses, so "(t:goblin or lang:xx)" gives "lang:xx". Null when there's no term to drop there.
const termAround = (text: string, at: number): { start: number; end: number } | null => {
  const isBoundary = (char: string | undefined) => char === undefined || /[\s()]/.test(char);
  let start = Math.min(at, text.length);
  while (start > 0 && !isBoundary(text[start - 1])) start -= 1;
  if (start >= text.length || isBoundary(text[start])) {
    // The parser stopped at a space or parenthesis: the problem is the term before it.
    let end = start;
    while (end > 0 && /\s/.test(text[end - 1]!)) end -= 1;
    if (end === 0 || isBoundary(text[end - 1])) return null;
    start = end;
    while (start > 0 && !isBoundary(text[start - 1])) start -= 1;
  }
  let end = start;
  let quote: string | null = null;
  while (end < text.length) {
    const char = text[end]!;
    if (quote) {
      if (char === '\\') end += 1;
      else if (char === quote) quote = null;
    } else if (
      // A quote or /regex/ opens at the start of the term or of its value; an apostrophe in a name doesn't.
      (char === '"' || char === "'" || char === '/') &&
      (end === start || /[:=<>!]$/.test(text.slice(start, end)))
    ) {
      quote = char;
    } else if (isBoundary(char)) {
      break;
    }
    end += 1;
  }
  if (text.slice(start, end) === IGNORED_PLACEHOLDER) return null;
  return { start, end };
};

// Parse, and when a term can't be parsed, leave it out and try again, as Scryfall does: "t:goblin lang:xx" searches
// for goblins and reports lang:xx as ignored. A parse that fails for another reason (an unclosed quote or
// parenthesis) is still an error.
const parseFilter = (filterText: string, strict: boolean): { results: any[]; ignored: string[]; err?: any } => {
  const ignored: string[] = [];
  let text = filterText;
  for (let attempt = 0; attempt <= (strict ? 0 : MAX_IGNORED_TERMS); attempt++) {
    const filterParser: Parser = new Parser(compiledGrammar);
    let failedAt: number | null = null;
    try {
      filterParser.feed(text);
    } catch (err) {
      failedAt = (err as { offset?: number }).offset ?? null;
      if (failedAt === null) return { results: [], ignored, err };
    }
    if (failedAt === null && filterParser.results.length > 0) {
      return { results: filterParser.results, ignored };
    }
    // An incomplete parse ran out of input, so the problem is the last term.
    const term = strict ? null : termAround(text, failedAt ?? text.length);
    const termText = term ? text.slice(term.start, term.end) : '';
    if (!term || !IGNORABLE_TERM.test(termText)) {
      return { results: [], ignored, err: 'Invalid filter' };
    }
    ignored.push(termText);
    text = `${text.slice(0, term.start)}${IGNORED_PLACEHOLDER}${text.slice(term.end)}`;
  }
  return { results: [], ignored, err: 'Invalid filter' };
};

// `strict` makes any term that can't be parsed an error instead of leaving it out. Filters the code builds itself
// (game themes, combo templates) use it, since a dropped term there would silently widen the results.
export function makeFilter(filterText: string, { strict = false }: { strict?: boolean } = {}): FilterResult {
  if (!filterText || filterText.trim() === '') {
    return {
      err: false,
      filter: null,
    };
  }

  if (filterText.length > MAX_FILTER_LENGTH) {
    return { err: 'Filter is too long', filter: null };
  }

  const { results, ignored, err } = parseFilter(filterText, strict);
  if (err) {
    return { err, filter: null };
  }
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
      filter.ignored = ignored;
      // Nothing left to search for once every term is ignored, so that's an error rather than every card.
      if (ignored.length > 0 && filter.neutral && !filter.directives && (filter.fieldsUsed ?? []).length === 0) {
        return { err: 'Invalid filter', filter: null };
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
