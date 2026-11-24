import { Distinct } from '@utils/cardSearchOptions';
import { CardDetails, DefaultPrintingPreference } from '@utils/datatypes/Card';
import { filterCardsDetails, FilterFunction, filterIncludesExtras, filterUses } from '@utils/filtering/FilterCards';
import { ORDERED_SORTS, OrderedSortsType, SortFunctionsOnDetails } from '@utils/sorting/Sort';
import { SortDirectionsType } from '@utils/sorting/sortContext';

import carddb, { getAllMostReasonable } from './carddb';

/* Page size for results */
const PAGE_SIZE = 96;

// Collect and sort every card matching the filter, without paginating. Used
// both by the paginated searchCards below and by the CSV export, which needs
// the full result set. Directives in the query (unique:, order:, direction:,
// prefer:) take precedence over the matching arguments, as on Scryfall.
export const searchAllCards = (
  filter: FilterFunction,
  sort: OrderedSortsType = 'Elo',
  direction: SortDirectionsType = 'descending',
  distinct: Distinct = 'names',
  printing = DefaultPrintingPreference,
  includeExtras = false,
  pool: CardDetails[] = carddb.searchCardList,
): CardDetails[] => {
  const directives = filter?.directives ?? {};
  const effectiveSort = directives.order ?? sort;
  const effectiveDirection = directives.direction ?? direction;
  const effectiveDistinct: Distinct = directives.unique
    ? directives.unique === 'prints'
      ? 'printings'
      : 'names'
    : distinct;
  const preferred = directives.prefer;

  // Collect matching cards, optionally including "extras" — tokens and other
  // printings normally hidden from card search (they live only in
  // printedCardListWithExtras / are left out of the pool otherwise).
  const collect = (includeExtras: boolean): CardDetails[] => {
    if (effectiveDistinct === 'names') {
      // One row per card: show its default printing, falling back to the user's
      // printing preference when the card has no default (or it's filtered out).
      // A prefer: directive picks the printing outright.
      return getAllMostReasonable(filter, preferred ?? printing, includeExtras, !preferred, pool);
    }
    // One row per printing: every printing is its own result, so leave them as-is.
    return filterCardsDetails(includeExtras ? carddb.printedCardListWithExtras : pool, filter);
  };

  // Extras (tokens, planes, playtest cards, etc.) are hidden by default.
  // Include them when: the caller asked (checkbox), the query has "include:extras",
  // or it's a set-scoped browse (a set may be entirely extras, e.g. memorabilia /
  // Jumpstart front cards). Otherwise only fall back to extras if nothing matched.
  const includeExtrasNow = includeExtras || filterIncludesExtras(filter) || filterUses(filter, 'set');
  const cards: CardDetails[] = collect(includeExtrasNow);
  if (cards.length === 0 && !includeExtrasNow) {
    cards.push(...collect(true));
  }

  if (ORDERED_SORTS.includes(effectiveSort)) {
    cards.sort(SortFunctionsOnDetails(effectiveSort));
  }

  if (effectiveDirection === 'descending') {
    cards.reverse();
  }

  return cards;
};

export const searchCards = (
  filter: FilterFunction,
  sort: OrderedSortsType = 'Elo',
  page: number = 0,
  direction: SortDirectionsType = 'descending',
  distinct: Distinct = 'names',
  printing = DefaultPrintingPreference,
  includeExtras = false,
) => {
  const cards = searchAllCards(filter, sort, direction, distinct, printing, includeExtras);

  return {
    numResults: cards.length,
    data: cards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
  };
};
