import { CardDetails, DefaultPrintingPreference } from '@utils/datatypes/Card';
import { filterCardsDetails, FilterFunction, filterIncludesExtras, filterUses } from '@utils/filtering/FilterCards';
import { ORDERED_SORTS, OrderedSortsType, SortFunctionsOnDetails } from '@utils/sorting/Sort';
import { SortDirectionsType } from '@utils/sorting/sortContext';

import carddb, { getAllMostReasonable } from './carddb';

/* Page size for results */
const PAGE_SIZE = 96;

type Distinct = 'names' | 'printing';

export const searchCards = (
  filter: FilterFunction,
  sort: OrderedSortsType = 'Elo',
  page: number = 0,
  direction: SortDirectionsType = 'descending',
  distinct: Distinct = 'names',
  printing = DefaultPrintingPreference,
  includeExtras = false,
) => {
  // Collect matching cards, optionally including "extras" — tokens and other
  // printings normally hidden from card search (they live only in
  // printedCardListWithExtras / are dropped by getAllMostReasonable otherwise).
  const collect = (includeExtras: boolean): CardDetails[] => {
    if (distinct === 'names') {
      // One row per card: show its default printing, falling back to the user's
      // printing preference when the card has no default (or it's filtered out).
      return getAllMostReasonable(filter, printing, includeExtras, true);
    }
    // One row per printing: every printing is its own result, so leave them as-is.
    return filterCardsDetails(includeExtras ? carddb.printedCardListWithExtras : carddb.printedCardList, filter);
  };

  // Extras (tokens, planes, digital, Unknown Event, etc.) are hidden by default.
  // Include them when: the caller asked (checkbox), the query has "include:extras",
  // or it's a set-scoped browse (a set may be entirely extras, e.g. memorabilia /
  // Jumpstart front cards). Otherwise only fall back to extras if nothing matched.
  const includeExtrasNow = includeExtras || filterIncludesExtras(filter) || filterUses(filter, 'set');
  const cards: CardDetails[] = collect(includeExtrasNow);
  if (cards.length === 0 && !includeExtrasNow) {
    cards.push(...collect(true));
  }

  if (ORDERED_SORTS.includes(sort)) {
    cards.sort(SortFunctionsOnDetails(sort));
  }

  if (direction === 'descending') {
    cards.reverse();
  }

  return {
    numResults: cards.length,
    data: cards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
  };
};
