import Card from 'datatypes/Card';
import { makeFilter, operatorsRegex } from 'filtering/FilterCards';

export interface Filter {
  filterText: string;
  fn: (card: Card) => boolean;
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
  };
};
