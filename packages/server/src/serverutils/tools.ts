import { CardDetails, PrintingPreference } from '@utils/datatypes/Card';
import { filterCardsDetails, FilterFunction, filterUses } from '@utils/filtering/FilterCards';
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
  printing = PrintingPreference.RECENT,
) => {
  // Collect matching cards, optionally including "extras" — tokens and other
  // printings normally hidden from card search (they live only in
  // printedCardListWithExtras / are dropped by getAllMostReasonable otherwise).
  const collect = (includeExtras: boolean): CardDetails[] => {
    if (distinct === 'names') {
      return getAllMostReasonable(filter, printing, includeExtras);
    }
    return filterCardsDetails(includeExtras ? carddb.printedCardListWithExtras : carddb.printedCardList, filter);
  };

  // A set: query browses a specific set (which may be entirely tokens, e.g.
  // memorabilia / Jumpstart front cards), so always include extras there. For any
  // other query, only fall back to including extras if the search comes up empty.
  const setSearch = filterUses(filter, 'set');
  const cards: CardDetails[] = collect(setSearch);
  if (cards.length === 0 && !setSearch) {
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
