import { Catalog } from '@utils/datatypes/CardCatalog';

// Fixture is built inside the factory (not an outer `const`): @swc/jest hoists
// `jest.mock` above module-scope declarations, so an outer const would be in the
// TDZ when the factory runs.
jest.mock('serverutils/cardCatalog', () => ({
  __esModule: true,
  default: {
    imagedict: {},
    cardimages: {},
    cardnames: [],
    comboTree: {},
    full_names: [],
    nameToId: {},
    oracleToId: {},
    english: {},
    _carddict: {},
    indexToOracle: [],
    oracleToIndex: {},
    metadatadict: {},
    printedCardList: [],
    printedCardListWithExtras: [],
    comboOracleToIndex: {},
    reasonable_names: [],
    reasonable_full_names: [],
    setdict: {},
  },
  whenCardDbReady: () => Promise.resolve(),
  isCardDbReady: () => true,
}));

import { CardDetails } from '@utils/datatypes/Card';
import { Request, Response } from 'express';
import { cardImageDataHandler } from 'router/routes/tool/api/cardimagedata';
import cardCatalog from 'serverutils/cardCatalog';
import { clearPrintingIndexCache } from 'serverutils/cardPrintings';

import { createCardDetails } from '../../../test-utils/data';

const mockCardCatalog = cardCatalog as unknown as Catalog;

const createMockReq = (query: Record<string, string>) =>
  ({
    query,
    logger: { error: jest.fn() },
  }) as unknown as Request;

const createMockRes = () =>
  ({
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  }) as unknown as Response;

const normalDetails: Partial<CardDetails> = {
  isExtra: false,
  isToken: false,
  promo: false,
  digital: false,
  layout: 'normal',
  language: 'en',
  set_type: 'expansion',
};

const seedCard = (details: CardDetails) => {
  mockCardCatalog._carddict[details.scryfall_id] = details;
  mockCardCatalog.printedCardList = [...mockCardCatalog.printedCardList, details];
  const nameKey = details.name_lower;
  mockCardCatalog.nameToId[nameKey] = [...(mockCardCatalog.nameToId[nameKey] ?? []), details.scryfall_id];
};

// One card, three printings, two names: the Secret Lair reskin comes first in the
// catalog, which is what makes "whichever printing resolves first" the wrong answer.
const HENGE_ORACLE = 'great-henge-oracle';
const seedHenge = () => {
  seedCard(
    createCardDetails({
      ...normalDetails,
      name: 'Party Tree',
      name_lower: 'party tree',
      full_name: 'party tree [sld-1]',
      oracle_id: HENGE_ORACLE,
      scryfall_id: 'henge-reskin',
      set: 'sld',
      setIndex: 9,
      reprint: true,
      art_crop: 'https://img/party-tree',
      artist: 'Reskin Artist',
    }),
  );
  seedCard(
    createCardDetails({
      ...normalDetails,
      name: 'The Great Henge',
      name_lower: 'the great henge',
      full_name: 'the great henge [2x2-1]',
      oracle_id: HENGE_ORACLE,
      scryfall_id: 'henge-reprint',
      set: '2x2',
      setIndex: 40,
      reprint: true,
      art_crop: 'https://img/henge-reprint',
      artist: 'Reprint Artist',
    }),
  );
  seedCard(
    createCardDetails({
      ...normalDetails,
      name: 'The Great Henge',
      name_lower: 'the great henge',
      full_name: 'the great henge [eld-161]',
      oracle_id: HENGE_ORACLE,
      scryfall_id: 'henge-original',
      set: 'eld',
      setIndex: 2,
      reprint: false,
      art_crop: 'https://img/henge-original',
      artist: 'Original Artist',
    }),
  );
};

const imageFor = async (query: Record<string, string>) => {
  const res = createMockRes();
  await cardImageDataHandler(createMockReq(query), res);
  expect(res.status).toHaveBeenCalledWith(200);
  return (res.send as jest.Mock).mock.calls[0][0].image;
};

describe('cardImageDataHandler', () => {
  beforeEach(() => {
    clearPrintingIndexCache();
    mockCardCatalog._carddict = {};
    mockCardCatalog.printedCardList = [];
    mockCardCatalog.nameToId = {};
    mockCardCatalog.imagedict = {};
    seedHenge();
  });

  it('requires a name', async () => {
    const res = createMockRes();
    await cardImageDataHandler(createMockReq({}), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns the first printing under firstPrinting=1', async () => {
    expect(await imageFor({ name: 'The Great Henge', firstPrinting: '1' })).toEqual({
      uri: 'https://img/henge-original',
      artist: 'Original Artist',
      id: 'henge-original',
      imageName: 'the great henge [eld-161]',
    });
  });

  it('resolves a reskin name to the card it reskins under firstPrinting=1', async () => {
    expect((await imageFor({ name: 'Party Tree', firstPrinting: '1' })).uri).toBe('https://img/henge-original');
  });

  it('leaves the catalog-order printing alone without the flag', async () => {
    // Unchanged behaviour for every other caller: the printing pickers (article
    // and video thumbnails, cube and profile art) choose a printing on purpose.
    expect((await imageFor({ name: 'Party Tree' })).uri).toBe('https://img/party-tree');
    expect((await imageFor({ name: 'The Great Henge' })).uri).toBe('https://img/henge-reprint');
  });

  it('still honours an explicit printing given as a full name', async () => {
    mockCardCatalog.imagedict = {
      'the great henge [2x2-1]': {
        uri: 'https://img/henge-reprint',
        artist: 'Reprint Artist',
        id: 'henge-reprint',
        imageName: 'the great henge [2x2-1]',
      },
    };

    expect((await imageFor({ name: 'The Great Henge [2X2-1]', firstPrinting: '1' })).uri).toBe(
      'https://img/henge-reprint',
    );
  });

  it('returns null for a name the catalog does not know', async () => {
    expect(await imageFor({ name: 'Not A Real Card', firstPrinting: '1' })).toBeNull();
  });
});
