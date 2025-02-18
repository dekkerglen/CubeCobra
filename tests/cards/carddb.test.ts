/* eslint-disable no-prototype-builtins */

import { Catalog } from '../../src/util/cardCatalog';

const mockCardCatalog: Catalog = {
  cardtree: {},
  imagedict: {},
  cardimages: {},
  cardnames: [],
  full_names: [],
  nameToId: {},
  oracleToId: {},
  english: {},
  _carddict: {},
  indexToOracle: [],
  metadatadict: {},
  printedCardList: [], // for card filters
};

jest.mock('../../src/util/cardCatalog', () => {
  return {
    __esModule: true,
    default: mockCardCatalog,
  };
});

import { FilterFunction } from '../../src/client/filtering/FilterCards';
import Card, { CardDetails } from '../../src/datatypes/Card';
import { getMostReasonable, reasonableCard } from '../../src/util/carddb';
import { createCard, createCardDetails } from '../test-utils/data';

const overridesForNormalDetails: Partial<CardDetails> = {
  isExtra: false,
  promo: false,
  digital: false,
  isToken: false,
  border_color: 'black',
  promo_types: undefined,
  language: 'en',
  tcgplayer_id: '12345',
  collector_number: '270',
  layout: 'normal',
};

describe('reasonableCard', () => {
  it('Regular details are reasonable', async () => {
    const details = createCardDetails(overridesForNormalDetails);

    expect(reasonableCard(details)).toBeTruthy();
  });

  it('Extras are not reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, isExtra: true });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Promos are not reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, promo: true });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Digital cards are not reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, digital: true });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Tokens are not reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, isToken: true });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Gold borders are not reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, border_color: 'gold' });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Promo variants are not reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, promo_types: ['boosterfun'] });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Non-english cards are not reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, language: 'fr' });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Must have TGC player ID to be reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, tcgplayer_id: undefined });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Must not be a promo based on collector number to be reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, collector_number: '177★' });

    expect(reasonableCard(details)).toBeFalsy();
  });

  it('Must not be an art series card to be reasonable', async () => {
    const details = createCardDetails({ ...overridesForNormalDetails, layout: 'art_series' });

    expect(reasonableCard(details)).toBeFalsy();
  });
});

describe('getMostReasonable', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const fillCatalogWithCards = (cards: Card[]) => {
    //Reset
    mockCardCatalog._carddict = {};
    mockCardCatalog.nameToId = {};
    mockCardCatalog.oracleToId = {};

    cards.forEach((card) => {
      const cardId = card.details?.scryfall_id || '';
      const name = card?.details?.name_lower || '';
      const oracleId = card?.details?.oracle_id || '';

      mockCardCatalog._carddict[cardId] = card.details;

      if (!mockCardCatalog.nameToId.hasOwnProperty(name)) {
        mockCardCatalog.nameToId[name] = [];
      }
      mockCardCatalog.nameToId[name].push(cardId);

      if (!mockCardCatalog.oracleToId.hasOwnProperty(oracleId)) {
        mockCardCatalog.oracleToId[oracleId] = [];
      }
      mockCardCatalog.oracleToId[oracleId].push(cardId);
    });
  };

  it('No match found by name', async () => {
    const cardOne = createCard({
      details: createCardDetails({ ...overridesForNormalDetails, name: 'Card 1', name_lower: 'card 1' }),
    });

    fillCatalogWithCards([cardOne]);
    expect(getMostReasonable('Unknown name', 'recent')).toBeNull();
  });

  it('Match found by name, one possible card', async () => {
    const cardOne = createCard({
      details: createCardDetails({ ...overridesForNormalDetails, name: 'Card 1', name_lower: 'card 1' }),
    });

    fillCatalogWithCards([cardOne]);
    expect(getMostReasonable('Card 1', 'recent')).toEqual(cardOne.details);
  });

  it('Unreasonable match found by name, but still returned as only card', async () => {
    const cardOne = createCard({
      details: createCardDetails({
        ...overridesForNormalDetails,
        name: 'Nexus of Fate',
        name_lower: 'nexus of fate',
        promo: true,
      }),
    });

    fillCatalogWithCards([cardOne]);
    expect(getMostReasonable('Nexus of Fate', 'recent')).toEqual(cardOne.details);
  });

  it('Many unreasonable match found by name, first card by printing returned', async () => {
    const cardOne = createCard({
      details: createCardDetails({
        ...overridesForNormalDetails,
        name: 'Nexus of Fate',
        name_lower: 'nexus of fate',
        promo: true,
        collector_number: '653',
      }),
    });
    const cardTwo = createCard({
      details: createCardDetails({
        ...overridesForNormalDetails,
        name: 'Nexus of Fate',
        name_lower: 'nexus of fate',
        promo: true,
        collector_number: '67',
      }),
    });

    fillCatalogWithCards([cardOne, cardTwo]);
    expect(getMostReasonable('Nexus of Fate', 'first')).toEqual(cardTwo.details);
  });

  it('Lookup by oracle id', async () => {
    const cardOne = createCard({
      details: createCardDetails({
        ...overridesForNormalDetails,
        name: 'Goblin Warleader',
        name_lower: 'goblin warleader',
        collector_number: '10',
        released_at: '2022/04/17',
        oracle_id: 'abcd-efgh',
      }),
    });
    const cardTwo = createCard({
      details: createCardDetails({
        ...overridesForNormalDetails,
        name: 'Goblin Warleader',
        name_lower: 'goblin warleader',
        collector_number: '10',
        released_at: '1995/01/31',
        oracle_id: '1234-5678',
      }),
    });

    fillCatalogWithCards([cardOne, cardTwo]);
    expect(getMostReasonable('abcd-efgh', 'first')).toEqual(cardTwo.details);
  });

  it('Lookup by full card name, only considers that exact set/collector number', async () => {
    const cardOne = createCard({
      details: createCardDetails({
        ...overridesForNormalDetails,
        name: 'Goblin Warleader',
        name_lower: 'goblin warleader',
        collector_number: '13',
        released_at: '2022/04/17',
        oracle_id: 'abcd-efgh',
        set: 'AFR',
        full_name: 'Goblin Warleader [ARF-13]',
      }),
    });
    const cardTwo = createCard({
      details: createCardDetails({
        ...overridesForNormalDetails,
        name: 'Goblin Warleader',
        name_lower: 'goblin warleader',
        collector_number: '10',
        released_at: '1995/01/31',
        oracle_id: '1234-5678',
        set: 'CMD',
        full_name: 'Goblin Warleader [CMD-10]',
      }),
    });

    fillCatalogWithCards([cardOne, cardTwo]);
    expect(getMostReasonable('Goblin Warleader [CMD-10]', 'recent')).toEqual(cardTwo.details);
  });

  it('Matches found by name, sorting by released at primarily', async () => {
    const cardOne = createCard({
      details: createCardDetails({
        ...overridesForNormalDetails,
        name: 'Giant Spider',
        name_lower: 'giant spider',
        collector_number: '10',
        released_at: '2022/04/17',
      }),
    });
    const cardTwo = createCard({
      details: createCardDetails({
        ...overridesForNormalDetails,
        name: 'Giant Spider',
        name_lower: 'giant spider',
        collector_number: '10',
        released_at: '1995/01/31',
      }),
    });

    fillCatalogWithCards([cardOne, cardTwo]);
    expect(getMostReasonable('Giant Spider', 'recent')).toEqual(cardOne.details);
    expect(getMostReasonable('Giant Spider', 'first')).toEqual(cardTwo.details);
  });

  it('Matches found by name, collector sorting secondary after released', async () => {
    const cardOne = createCard({
      details: createCardDetails({
        ...overridesForNormalDetails,
        name: 'Giant Spider',
        name_lower: 'giant spider',
        collector_number: '232',
        released_at: '2022/04/17',
      }),
    });
    const cardTwo = createCard({
      details: createCardDetails({
        ...overridesForNormalDetails,
        name: 'Giant Spider',
        name_lower: 'giant spider',
        collector_number: '17',
        released_at: '2022/04/17',
      }),
    });

    const cardThree = createCard({
      details: createCardDetails({
        ...overridesForNormalDetails,
        name: 'Giant Spider',
        name_lower: 'giant spider',
        collector_number: '477',
        released_at: '2022/04/17',
      }),
    });

    fillCatalogWithCards([cardOne, cardTwo, cardThree]);
    expect(getMostReasonable('Giant Spider', 'recent')).toEqual(cardThree.details);
    expect(getMostReasonable('Giant Spider', 'first')).toEqual(cardTwo.details);
  });

  it('Matches found by name, filters to none', async () => {
    const cardOne = createCard({
      details: createCardDetails({
        ...overridesForNormalDetails,
        name: 'Giant Spider',
        name_lower: 'giant spider',
        collector_number: '232',
        released_at: '2022/04/17',
      }),
    });
    const cardTwo = createCard({
      details: createCardDetails({
        ...overridesForNormalDetails,
        name: 'Giant Spider',
        name_lower: 'giant spider',
        collector_number: '17',
        released_at: '2022/04/17',
      }),
    });

    const cardThree = createCard({
      details: createCardDetails({
        ...overridesForNormalDetails,
        name: 'Giant Spider',
        name_lower: 'giant spider',
        collector_number: '477',
        released_at: '2022/04/17',
      }),
    });

    const filter: FilterFunction = (): boolean => {
      return false;
    };
    filter.stringify = 'blah';
    filter.fieldsUsed = ['name'];

    fillCatalogWithCards([cardOne, cardTwo, cardThree]);
    expect(getMostReasonable('Giant Spider', 'recent', filter)).toBeNull();
  });

  it('Matches found by name and filtering', async () => {
    const cardOne = createCard({
      details: createCardDetails({
        ...overridesForNormalDetails,
        name: 'Giant Spider',
        name_lower: 'giant spider',
        collector_number: '232',
        released_at: '2022/04/17',
        set: 'DMR',
      }),
    });
    const cardTwo = createCard({
      details: createCardDetails({
        ...overridesForNormalDetails,
        name: 'Giant Spider',
        name_lower: 'giant spider',
        collector_number: '17',
        released_at: '2022/04/17',
        set: 'LEA',
      }),
    });

    const cardThree = createCard({
      details: createCardDetails({
        ...overridesForNormalDetails,
        name: 'Giant Spider',
        name_lower: 'giant spider',
        collector_number: '477',
        released_at: '2022/04/17',
        set: 'DMR',
      }),
    });

    const filter: FilterFunction = (card): boolean => {
      return card.details?.set.includes('DMR') || false;
    };
    filter.stringify = 'blah';
    filter.fieldsUsed = ['set'];

    fillCatalogWithCards([cardOne, cardTwo, cardThree]);
    expect(getMostReasonable('Giant Spider', 'first', filter)).toEqual(cardOne.details);
  });
});
