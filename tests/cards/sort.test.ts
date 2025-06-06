import { cardGetLabels, getLabelsRaw, sortForDownload } from '../../src/client/utils/Sort';
import Card from '../../src/datatypes/Card';
import { createCard, createCardDetails } from '../test-utils/data';

const mapToCardNames = (sorted: Card[]) => {
  return sorted.map((c) => c.details?.name);
};

const sortWithoutGrouping = (cards: Card[], sort: string) => {
  //Must pass true for showOther because the first sort is undefined
  return sortForDownload(cards, 'Unsorted', 'Unsorted', 'Unsorted', sort, true);
};

describe('Sorting Collector Numbers', () => {
  const SORT = 'Collector number';

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

    const sorted = sortWithoutGrouping(cards, SORT);

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

    const sorted = sortWithoutGrouping(cards, SORT);

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

    const sorted = sortWithoutGrouping(cards, SORT);

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

    const sorted = sortWithoutGrouping(cards, SORT);

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

    const sorted = sortWithoutGrouping(cards, SORT);

    expect(mapToCardNames(sorted)).toEqual(['Card 6', 'Card 4', 'Card 5', 'Card 3', 'Card 1', 'Card 2']);
  });
});

describe('Sorting by Word Count', () => {
  const SORT = 'Word Count';

  it('Should sort cards if `wordCount` is already populated', () => {
    const cards = [
      createCard({
        details: createCardDetails({ name: 'Medium Card', oracle_text: 'A B C D E F', wordCount: 6 }),
      }),
      createCard({
        details: createCardDetails({ name: 'Short Card', oracle_text: 'A B C D E', wordCount: 5 }),
      }),
      createCard({
        details: createCardDetails({ name: 'Long Card', oracle_text: 'A B C D E F G', wordCount: 7 }),
      }),
    ];

    const sorted = sortWithoutGrouping(cards, SORT);

    expect(mapToCardNames(sorted)).toEqual(['Short Card', 'Medium Card', 'Long Card']);
  });

  it('Should populate `wordCount` and sort by it', () => {
    const cards = [
      createCard({
        details: createCardDetails({ name: 'Medium Card', oracle_text: 'A B C D E F' }),
      }),
      createCard({
        details: createCardDetails({ name: 'Short Card', oracle_text: 'A B C D E' }),
      }),
      createCard({
        details: createCardDetails({ name: 'Long Card', oracle_text: 'A B C D E F G' }),
      }),
    ];

    const sorted = sortWithoutGrouping(cards, SORT);

    expect(mapToCardNames(sorted)).toEqual(['Short Card', 'Medium Card', 'Long Card']);
    expect(sorted[0].details?.wordCount).toBe(5);
    expect(sorted[1].details?.wordCount).toBe(6);
    expect(sorted[2].details?.wordCount).toBe(7);
  });
});

describe('Grouping by Word Count', () => {
  const sort = 'Word Count';

  it('Should group cards by word count', () => {
    const cards = [
      createCard({
        details: createCardDetails({ name: 'Isamaru, Hound of Konda', oracle_text: '' }),
      }),
      createCard({
        details: createCardDetails({
          name: 'Lightning Bolt',
          oracle_text: 'Lightning Bolt deals 3 damage to any target.',
        }),
      }),
      createCard({
        details: createCardDetails({ name: 'Dance of the Dead', wordCount: 107 }),
      }),
    ];

    const labels = getLabelsRaw(cards, sort, false);

    expect(labels).toEqual(['0', '5+', '100+']);
  });
});

/* Ideally would use sortDeep to get the cards grouped into buckets to test a larger amount of the sorting code, but
 * had trouble with Typescript extracting the DeepSorted contents to be able to expect on them.
 * See priceBuckets constant in src/client/utils/Sort.ts for the groupings
 */
describe('Grouping by Price USD', () => {
  const SORT = 'Price USD';

  it('Has USD price for grouping', async () => {
    const card = createCard({
      details: createCardDetails({
        name: 'Card 1',
        prices: {
          usd: 4.23,
        },
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual(['$4 - $4.99']);
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

    const labels = cardGetLabels(card, 'Price USD Foil', true);

    expect(labels).toEqual(['$20 - $24.99']);
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

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual(['>= $100']);
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

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual(['$50 - $74.99']);
  });

  it('Foil fallback has precedence over etched', async () => {
    const card = createCard({
      details: createCardDetails({
        name: 'Card 1',
        prices: {
          usd_foil: 123.11,
          usd_etched: 66.6,
        },
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual(['>= $100']);
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

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual(['No Price Available']);
  });
});

describe('Grouping by Price USD Foil', () => {
  const SORT = 'Price USD Foil';

  it('Has USD foil price for grouping', async () => {
    const card = createCard({
      details: createCardDetails({
        name: 'Card 1',
        prices: {
          usd_foil: 4.23,
        },
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual(['$4 - $4.99']);
  });

  it('Has USD price for grouping, with regular fallback', async () => {
    const card = createCard({
      details: createCardDetails({
        name: 'Card 1',
        prices: {
          usd: 23.11,
        },
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual(['$20 - $24.99']);
  });

  it('Has USD foil price for grouping, with etched fallback', async () => {
    const card = createCard({
      details: createCardDetails({
        name: 'Card 1',
        prices: {
          usd_etched: 66.6,
        },
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual(['$50 - $74.99']);
  });

  it('Etched fallback has precedence over usd', async () => {
    const card = createCard({
      details: createCardDetails({
        name: 'Card 1',
        prices: {
          usd_etched: 99.2,
          usd: 33.1,
        },
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual(['$75 - $99.99']);
  });

  it('No USD foil price available for grouping', async () => {
    const card = createCard({
      details: createCardDetails({
        name: 'Card 1',
        prices: {
          eur: 23.11,
        },
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual(['No Price Available']);
  });
});

const allowedTypeSeparators = ['-', '–', '—'];

//Subtypes can be anything, so we will validate both the card's labels and the raw labels across multiple cards
describe('Grouping by Subtype', () => {
  const SORT = 'Subtype';

  it('Card has type_line but no subtype', async () => {
    const card = createCard({
      type_line: 'Sorcery',
      details: createCardDetails({
        type: 'Instant',
      }),
    });

    const labels = cardGetLabels(card, SORT, true);
    expect(labels).toEqual([' Other ']);

    const rawLabels = getLabelsRaw([card], SORT, true);
    expect(rawLabels).toEqual([' Other ']);
  });

  it('Card has type_line with subtype', async () => {
    const card = createCard({
      type_line: 'Sorcery - Arcane',
      details: createCardDetails({
        type: 'Instant',
      }),
    });

    //For card labels, ' Other ' is only added if no labels were found for the card
    const labels = cardGetLabels(card, SORT, true);
    expect(labels).toEqual(['Arcane']);

    //For raw labels, ' Other ' gets added when the flag is set regardless of if other labels were found
    const rawLabels = getLabelsRaw([card], SORT, true);
    expect(rawLabels).toEqual(['Arcane', ' Other ']);
  });

  it('Card has type_line with multiple subtypes', async () => {
    const card = createCard({
      type_line: 'Creature - Mouse Lord',
      details: createCardDetails({
        type: 'Instant',
      }),
    });

    const labels = cardGetLabels(card, SORT, true);
    expect(labels).toEqual(['Mouse', 'Lord']);

    const rawLabels = getLabelsRaw([card], SORT, true);
    expect(rawLabels).toEqual(['Mouse', 'Lord', ' Other ']);
  });

  it('Falls back to card type', async () => {
    const card = createCard({
      type_line: undefined,
      details: createCardDetails({
        type: 'Instant - Arcane',
      }),
    });

    const labels = cardGetLabels(card, SORT, true);
    expect(labels).toEqual(['Arcane']);

    const rawLabels = getLabelsRaw([card], SORT, true);
    expect(rawLabels).toEqual(['Arcane', ' Other ']);
  });

  it('Handles separator but no types after', async () => {
    const card = createCard({
      type_line: undefined,
      details: createCardDetails({
        type: 'Instant - ',
      }),
    });

    const labels = cardGetLabels(card, SORT, true);
    expect(labels).toEqual([' Other ']);

    const rawLabels = getLabelsRaw([card], SORT, true);
    expect(rawLabels).toEqual([' Other ']);
  });

  it.each(allowedTypeSeparators)(`Handles separator character (%s)`, async (separator) => {
    const card = createCard({
      type_line: `Creature ${separator} Tiger`,
      details: createCardDetails({
        type: 'Instant',
      }),
    });

    const labels = cardGetLabels(card, SORT, true);
    expect(labels).toEqual(['Tiger']);

    const rawLabels = getLabelsRaw([card], SORT, true);
    expect(rawLabels).toEqual(['Tiger', ' Other ']);
  });

  it('Raw labels are a set of subtypes across multiple cards', async () => {
    const cards = [
      createCard({
        type_line: 'Creature - Mouse Lord',
        details: createCardDetails({
          type: 'Instant',
        }),
      }),
      createCard({
        type_line: 'Creature - Zombie Lord',
        details: createCardDetails({
          type: 'Instant',
        }),
      }),
      createCard({
        type_line: 'Creature - Phyrexian     Scout    Soldier',
        details: createCardDetails({
          type: 'Instant',
        }),
      }),
    ];

    const rawLabels = getLabelsRaw(cards, SORT, false);
    //Here we don't care how the subtypes are sorted in the labels. Other sorting code sorts them
    expect(rawLabels.sort()).toEqual(['Mouse', 'Scout', 'Soldier', 'Zombie', 'Lord', 'Phyrexian'].sort());
  });
});

//Supertypes are fixed so checking getRawLabels is not intesting
describe('Grouping by Supertype', () => {
  const SORT = 'Supertype';

  it('Card has type_line but no supertype', async () => {
    const card = createCard({
      type_line: 'Sorcery',
      details: createCardDetails({
        type: 'Instant',
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual([' Other ']);
  });

  it('Card has type_line and supertype', async () => {
    const card = createCard({
      type_line: 'Legendary Sorcery',
      details: createCardDetails({
        type: 'Instant',
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual(['Legendary']);
  });

  it('Card has type_line with multiple supertypes', async () => {
    const card = createCard({
      type_line: 'Legendary Snow Sorcery - Arcane',
      details: createCardDetails({
        type: 'Instant',
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual(['Legendary', 'Snow']);
  });

  it('Card has type_line but unknown supertype', async () => {
    const card = createCard({
      type_line: 'Miracle Sorcery',
      details: createCardDetails({
        type: 'Instant',
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual([' Other ']);
  });

  it('Falls back to card type', async () => {
    const card = createCard({
      type_line: undefined,
      details: createCardDetails({
        type: 'Host Creature - Octopus',
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual(['Host']);
  });

  it('Handles separator but no super types', async () => {
    const card = createCard({
      type_line: undefined,
      details: createCardDetails({
        type: '- Octopus',
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual([' Other ']);
  });

  it.each(allowedTypeSeparators)(`Handles separator character (%s)`, async (separator) => {
    const card = createCard({
      type_line: `Basic ${separator} Forest`,
      details: createCardDetails({
        type: 'Instant',
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual(['Basic']);
  });
});

//Types are fixed so checking getRawLabels is not intesting
describe('Grouping by type', () => {
  const SORT = 'Type';

  it('Card has type_line but no type', async () => {
    const card = createCard({
      type_line: 'Variable - Food',
      details: createCardDetails({
        type: 'Instant',
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual([' Other ']);
  });

  it('Card has type_line and type', async () => {
    const card = createCard({
      type_line: 'Legendary Sorcery',
      details: createCardDetails({
        type: 'Instant',
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual(['Sorcery']);
  });

  it('Card has type_line with multiple types', async () => {
    const card = createCard({
      type_line: 'Artifact Planeswalker',
      details: createCardDetails({
        type: 'Instant',
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual(['Artifact', 'Planeswalker']);
  });

  it('Card has type_line but unknown type', async () => {
    const card = createCard({
      type_line: 'Miracle',
      details: createCardDetails({
        type: 'Instant',
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual([' Other ']);
  });

  it('Falls back to card type', async () => {
    const card = createCard({
      type_line: undefined,
      details: createCardDetails({
        type: 'Host Creature - Octopus',
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual(['Creature']);
  });

  it('Handles separator but no types', async () => {
    const card = createCard({
      type_line: undefined,
      details: createCardDetails({
        type: '- Octopus',
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual([' Other ']);
  });

  it.each(allowedTypeSeparators)(`Handles separator character (%s)`, async (separator) => {
    const card = createCard({
      type_line: `Land ${separator} - Gate`,
      details: createCardDetails({
        type: 'Instant',
      }),
    });

    const labels = cardGetLabels(card, SORT, true);

    expect(labels).toEqual(['Land']);
  });
});
