import { filterCardsDetails, FilterFunction } from '../client/filtering/FilterCards';
import { SortDirectionsType } from '../client/hooks/UseSortableData';
import { ORDERED_SORTS, OrderedSortsType, SortFunctionsOnDetails } from '../client/utils/Sort';
import { PrintingPreference } from '../datatypes/Card';
import carddb, { getAllMostReasonable } from '../util/carddb';

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
  const cards = [];

  if (distinct === 'names') {
    cards.push(...getAllMostReasonable(filter, printing));
  } else {
    cards.push(...filterCardsDetails(carddb.printedCardList, filter));
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
