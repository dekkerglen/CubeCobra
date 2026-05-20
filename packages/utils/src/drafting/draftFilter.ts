import Card from '../datatypes/Card';
import { AllField } from '../datatypes/Card';
import { makeFilter, operatorsRegex } from '../filtering/FilterCards';

export interface Filter {
  filterText: string;
  fn: (card: Card) => boolean;
  fieldsUsed: AllField[];
}

export const matchingCards = (cards: Card[], filter: Filter | null): Card[] => {
  if (filter) {
    return cards.filter(filter.fn);
  }
  return cards;
};

export const compileFilter = (filterText: string): Filter => {
  if (!filterText || filterText === '' || filterText === '*') {
    return {
      fn: () => true,
      filterText,
      fieldsUsed: [],
    };
  }

  let tagfilterText: string | null = null;
  if (!operatorsRegex.test(filterText)) {
    // if it contains spaces then wrap in quotes
    tagfilterText = filterText;
    if (tagfilterText.indexOf(' ') >= 0 && !tagfilterText.startsWith('"')) {
      tagfilterText = `"${filterText}"`;
    }
    tagfilterText = `tag:${tagfilterText}`; // TODO: use tag instead of 'tag'
  }
  const { filter, err } = makeFilter(tagfilterText || filterText);
  if (err || !filter) {
    throw new Error(`Invalid card filter: ${filterText}`);
  }
  return {
    fn: filter,
    filterText,
    fieldsUsed: filter.fieldsUsed ?? [],
  };
};

/**
 * Compile a draft-format slot filter. Slots default to drawing from the
 * mainboard unless the user explicitly references the `board` field in the
 * filter expression (anywhere, including inside an OR like
 * `c=r (board=mainboard or board=modulex)`).
 *
 * The legacy `slot.board` field on old un-migrated formats is used as the
 * default board when no `board=` clause is present. This lets old data keep
 * working until it gets edited and re-saved (at which point the legacy field
 * is rolled into the filter string and removed).
 *
 * Note: this depends on the filter grammar having the `board=` rule compiled
 * in (run `npm run nearley` in packages/utils after changing cardFilters.ne).
 */
export const compileSlotFilter = (filterText: string | undefined, legacyBoard?: string): Filter => {
  const text = (filterText ?? '').trim();
  const defaultBoard = legacyBoard && legacyBoard !== '' ? legacyBoard : 'mainboard';

  // Empty / wildcard filter: still scope to the default board.
  if (text === '' || text === '*') {
    return compileFilter(`board=${defaultBoard}`);
  }

  // Compile the user's filter to detect whether it references `board`.
  const baseFilter = compileFilter(text);
  if (baseFilter.fieldsUsed.includes('board')) {
    // User expressed their own board scope (possibly spanning multiple
    // boards via OR) — trust it entirely.
    return baseFilter;
  }

  // Filter didn't mention `board`; AND it with the default-board scope.
  // The grammar's implicit connector is `and`, so juxtaposition is enough.
  return compileFilter(`(${text}) board=${defaultBoard}`);
};
