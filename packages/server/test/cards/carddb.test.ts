/* eslint-disable no-prototype-builtins */

import { Catalog } from '@utils/datatypes/CardCatalog';

const mockCardCatalog: Catalog = {
  cardtree: {},
  imagedict: {},
  cardimages: {},
  cardnames: [],
  comboTree: {},
  comboDict: {},
  full_names: [],
  nameToId: {},
  oracleToId: {},
  english: {},
  _carddict: {},
  indexToOracle: [],
  oracleToIndex: {},
  metadatadict: {},
  printedCardList: [], // for card filters
};

jest.mock('serverutils/cardCatalog', () => {
  return {
    __esModule: true,
    default: mockCardCatalog,
  };
});

import Card, { CardDetails, PrintingPreference } from '@utils/datatypes/Card';
import { FilterFunction } from '@utils/filtering/FilterCards';
import { getMostReasonable } from 'serverutils/carddb';

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
    expect(getMostReasonable('Unknown name', PrintingPreference.RECENT)).toBeNull();
  });

  it('Match found by name, one possible card', async () => {
    const cardOne = createCard({
      details: createCardDetails({ ...overridesForNormalDetails, name: 'Card 1', name_lower: 'card 1' }),
    });

    fillCatalogWithCards([cardOne]);
    expect(getMostReasonable('Card 1', PrintingPreference.RECENT)).toEqual(cardOne.details);
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
    expect(getMostReasonable('Nexus of Fate', PrintingPreference.RECENT)).toEqual(cardOne.details);
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
    expect(getMostReasonable('Nexus of Fate', PrintingPreference.FIRST)).toEqual(cardTwo.details);
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
    expect(getMostReasonable('abcd-efgh', PrintingPreference.FIRST)).toEqual(cardTwo.details);
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
    expect(getMostReasonable('Goblin Warleader [CMD-10]', PrintingPreference.RECENT)).toEqual(cardTwo.details);
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
    expect(getMostReasonable('Giant Spider', PrintingPreference.RECENT)).toEqual(cardOne.details);
    expect(getMostReasonable('Giant Spider', PrintingPreference.FIRST)).toEqual(cardTwo.details);
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
    expect(getMostReasonable('Giant Spider', PrintingPreference.RECENT)).toEqual(cardThree.details);
    expect(getMostReasonable('Giant Spider', PrintingPreference.FIRST)).toEqual(cardTwo.details);
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
    expect(getMostReasonable('Giant Spider', PrintingPreference.RECENT, filter)).toBeNull();
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
    expect(getMostReasonable('Giant Spider', PrintingPreference.FIRST, filter)).toEqual(cardOne.details);
  });
});
