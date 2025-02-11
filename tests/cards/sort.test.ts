import { cardGetLabels, sortForDownload } from '../../src/client/utils/Sort';
import Card from '../../src/datatypes/Card';
import { createCard, createCardDetails } from '../test-utils/data';

const mapToCardNames = (sorted: Card[]) => {
  return sorted.map((c) => c.details?.name);
};

describe('Sorting Collector Numbers', () => {
  const COLLECTOR_NUMBER_SORT = 'Collector number';

  const sortWithoutGrouping = (cards: Card[], sort: string) => {
    //Must pass true for showOther because the first sort is undefined
    return sortForDownload(cards, 'Unsorted', 'Unsorted', 'Unsorted', sort, true);
  };

  /* This is not an exhaustive list of non-standard collector numbers, but various examples to illustrate
   * how collector numbers are not simple numbers.
   */
  const EXAMPLE_NON_STANDARD_COLLECTOR_NUMBERS = {
    PLANESWALKER_CHAMPIONSHIP_PROMO_CN: '2024-03', //eg. https://scryfall.com/search?as=grid&order=name&q=%28game%3Apaper%29+set%3Apwcs
    SET_PROMOS: '49p', //eg. https://scryfall.com/search?as=grid&order=name&q=%28game%3Apaper%29+set%3Apblb
    MAGIC_ONLINE_THEME_DECKS: 'B14', //eg. https://scryfall.com/sets/td0?as=grid&order=set
    UNKNOWN_EVENT: 'UA03a', //eg. https://scryfall.com/search?as=grid&order=name&q=%28game%3Apaper%29+set%3Ada1
    CARD_ART_VARIANTS: '10a', //eg. https://scryfall.com/card/fem/10a/icatian-moneychanger
    WORLD_CHAMPIONSHIP_DECKS: 'ap100', //eg. https://scryfall.com/search?as=grid&order=name&q=%28game%3Apaper%29+set%3Awc04
    PROMO_CARD_VARIANT: '75★', //eg. https://scryfall.com/card/pths/75%E2%98%85/abhorrent-overlord
    STARTER_CARD_VARIANT: '101†', //eg. https://scryfall.com/card/aer/101%E2%80%A0/wrangle
    THE_LIST: 'SHM-150', //eg. https://scryfall.com/search?as=grid&order=name&q=%28game%3Apaper%29+set%3Aplst
    MAGIC_ONLINE_PROMO: '95299', //eg. https://scryfall.com/search?order=set&q=set%3Aprm+year%3A2025&unique=prints
  };

  it('Sorting by collector number should be numeric-like', async () => {
    const cards = [
      createCard({
        details: createCardDetails({ name: 'Card 1', collector_number: '10' }),
      }),
      createCard({
        details: createCardDetails({ name: 'Card 2', collector_number: '5' }),
      }),
    ];

    const sorted = sortWithoutGrouping(cards, COLLECTOR_NUMBER_SORT);

    expect(mapToCardNames(sorted)).toEqual(['Card 2', 'Card 1']);
  });

  /* List cards collector numbers are in the form of SET-NUMBER, eg C14-145 or SHM-150
   */
  it('Sorting by collector number should be numeric-like, for list cards in the same set', async () => {
    const cards = [
      createCard({
        details: createCardDetails({ name: 'Card 1', collector_number: 'SHM-47' }),
      }),
      createCard({
        details: createCardDetails({ name: 'Card 2', collector_number: 'SHM-150' }),
      }),
      createCard({
        details: createCardDetails({ name: 'Card 3', collector_number: 'SHM-5' }),
      }),
    ];

    const sorted = sortWithoutGrouping(cards, COLLECTOR_NUMBER_SORT);

    expect(mapToCardNames(sorted)).toEqual(['Card 3', 'Card 1', 'Card 2']);
  });

  it('Sorting by collector number with card variants', async () => {
    const cards = [
      createCard({
        details: createCardDetails({ name: 'Card 1', collector_number: '75' }),
      }),
      createCard({
        details: createCardDetails({
          name: 'Card 2',
          collector_number: EXAMPLE_NON_STANDARD_COLLECTOR_NUMBERS.STARTER_CARD_VARIANT,
        }),
      }),
      createCard({
        details: createCardDetails({
          name: 'Card 3',
          collector_number: EXAMPLE_NON_STANDARD_COLLECTOR_NUMBERS.PROMO_CARD_VARIANT,
        }),
      }),
      createCard({
        details: createCardDetails({ name: 'Card 4', collector_number: '101' }),
      }),
      createCard({
        details: createCardDetails({ name: 'Card 5', collector_number: '101★' }),
      }),
      createCard({
        details: createCardDetails({ name: 'Card 6', collector_number: '75b' }),
      }),
      createCard({
        details: createCardDetails({ name: 'Card 7', collector_number: '75a' }),
      }),
    ];

    const sorted = sortWithoutGrouping(cards, COLLECTOR_NUMBER_SORT);

    expect(mapToCardNames(sorted)).toEqual(['Card 1', 'Card 7', 'Card 6', 'Card 3', 'Card 4', 'Card 2', 'Card 5']);
  });

  it('Sorting by collector number for List cards (dash separated to be exact)', async () => {
    const cards = [
      createCard({
        details: createCardDetails({
          name: 'Card 1',
          collector_number: EXAMPLE_NON_STANDARD_COLLECTOR_NUMBERS.THE_LIST,
        }),
      }),
      createCard({
        details: createCardDetails({ name: 'Card 2', collector_number: 'SHM-20' }),
      }),
      createCard({
        details: createCardDetails({ name: 'Card 3', collector_number: 'SHM-188' }),
      }),
      createCard({
        details: createCardDetails({ name: 'Card 4', collector_number: 'ORI-38' }),
      }),
      createCard({
        details: createCardDetails({ name: 'Card 5', collector_number: 'TMP-304' }),
      }),
      //Will be last because 2024 has more characters than any 3 letter set symbol
      createCard({
        details: createCardDetails({
          name: 'Card 6',
          collector_number: EXAMPLE_NON_STANDARD_COLLECTOR_NUMBERS.PLANESWALKER_CHAMPIONSHIP_PROMO_CN,
        }),
      }),
      createCard({
        details: createCardDetails({ name: 'Card 7', collector_number: '8ED-72' }),
      }),
    ];

    const sorted = sortWithoutGrouping(cards, COLLECTOR_NUMBER_SORT);

    expect(mapToCardNames(sorted)).toEqual(['Card 7', 'Card 4', 'Card 2', 'Card 1', 'Card 3', 'Card 5', 'Card 6']);
  });

  it('Sorting by collector number with many non-standard numbers', async () => {
    const cards = [
      createCard({
        details: createCardDetails({
          name: 'Card 1',
          collector_number: EXAMPLE_NON_STANDARD_COLLECTOR_NUMBERS.MAGIC_ONLINE_PROMO,
        }),
      }),
      createCard({
        details: createCardDetails({
          name: 'Card 2',
          collector_number: EXAMPLE_NON_STANDARD_COLLECTOR_NUMBERS.WORLD_CHAMPIONSHIP_DECKS,
        }),
      }),
      createCard({
        details: createCardDetails({
          name: 'Card 3',
          collector_number: EXAMPLE_NON_STANDARD_COLLECTOR_NUMBERS.UNKNOWN_EVENT,
        }),
      }),
      createCard({
        details: createCardDetails({
          name: 'Card 4',
          collector_number: EXAMPLE_NON_STANDARD_COLLECTOR_NUMBERS.MAGIC_ONLINE_THEME_DECKS,
        }),
      }),
      createCard({
        details: createCardDetails({
          name: 'Card 5',
          collector_number: EXAMPLE_NON_STANDARD_COLLECTOR_NUMBERS.PLANESWALKER_CHAMPIONSHIP_PROMO_CN,
        }),
      }),
      createCard({
        details: createCardDetails({
          name: 'Card 6',
          collector_number: '42',
        }),
      }),
    ];

    const sorted = sortWithoutGrouping(cards, COLLECTOR_NUMBER_SORT);

    expect(mapToCardNames(sorted)).toEqual(['Card 6', 'Card 4', 'Card 5', 'Card 3', 'Card 1', 'Card 2']);
  });
});

/* Ideally would use sortDeep to get the cards grouped into buckets to test a larger amount of the sorting code, but
 * had trouble with Typescript extracting the DeepSorted contents to be able to expect on them.
 * See priceBuckets constant in src/client/utils/Sort.ts for the groupings
 */
describe('Grouping by Price USD', () => {
  const PRICE_USD_SORT = 'Price USD';

  it('Has USD price for grouping', async () => {
    const card = createCard({
      details: createCardDetails({
        name: 'Card 1',
        prices: {
          usd: 4.23,
        },
      }),
    });

    const label = cardGetLabels(card, PRICE_USD_SORT, true);

    expect(label).toEqual(['$4 - $4.99']);
  });

  it('Has USD foil price for grouping', async () => {
    const card = createCard({
      details: createCardDetails({
        name: 'Card 1',
        prices: {
          usd_foil: 23.11,
        },
      }),
    });

    const label = cardGetLabels(card, 'Price USD Foil', true);

    expect(label).toEqual(['$20 - $24.99']);
  });

  it('Has USD price for grouping, with foil fallback', async () => {
    const card = createCard({
      details: createCardDetails({
        name: 'Card 1',
        prices: {
          usd_foil: 999.11,
        },
      }),
    });

    const label = cardGetLabels(card, PRICE_USD_SORT, true);

    expect(label).toEqual(['>= $100']);
  });

  it('Has USD price for grouping, with etched fallback', async () => {
    const card = createCard({
      details: createCardDetails({
        name: 'Card 1',
        prices: {
          usd_etched: 66.6,
        },
      }),
    });

    const label = cardGetLabels(card, PRICE_USD_SORT, true);

    expect(label).toEqual(['$50 - $74.99']);
  });

  it('No USD price available for grouping', async () => {
    const card = createCard({
      details: createCardDetails({
        name: 'Card 1',
        prices: {
          eur: 23.11,
        },
      }),
    });

    const label = cardGetLabels(card, PRICE_USD_SORT, true);

    expect(label).toEqual(['No Price Available']);
  });
});
