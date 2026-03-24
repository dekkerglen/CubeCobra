import { FeedTypes } from '@utils/datatypes/Feed';
import * as carddb from 'serverutils/carddb';
import { bulkUpload } from 'serverutils/cube';
import * as cubefn from 'serverutils/cubefn';
import * as render from 'serverutils/render';

import { blogDao, changelogDao, cubeDao, feedDao } from '../../../src/dynamo/daos';
import { createCardDetails, createCube, createUser } from '../../test-utils/data';

jest.mock('../../../src/dynamo/models/cube');
jest.mock('../../../src/dynamo/daos', () => ({
  blogDao: {
    createBlog: jest.fn(),
  },
  changelogDao: {
    createChangelog: jest.fn(),
  },
  cubeDao: {
    getCards: jest.fn(),
    updateCards: jest.fn(),
  },
  feedDao: {
    batchPutUnhydrated: jest.fn(),
  },
}));
jest.mock('serverutils/carddb');
jest.mock('serverutils/cubefn');
jest.mock('serverutils/render');
jest.mock('serverutils/cube', () => ({
  ...jest.requireActual('serverutils/cube'),
}));

describe('Bulk Upload', () => {
  const flashMock = jest.fn();

  const setupBasicMocks = (
    existingCards: { mainboard: any[]; maybeboard: any[] } = { mainboard: [], maybeboard: [] },
  ) => {
    (cubeDao.getCards as jest.Mock).mockResolvedValue(existingCards);
    (changelogDao.createChangelog as jest.Mock).mockResolvedValue('changelog-id');
    (blogDao.createBlog as jest.Mock).mockResolvedValue('blog-id');
  };

  const createMockCardFromCSV = (details: any) => ({
    tags: [],
    status: 'Owned',
    colors: details.color_identity,
    cmc: details.cmc,
    cardID: details.scryfall_id,
    type_line: details.type,
    addedTmsp: new Date().valueOf().toString(),
    finish: 'Non-foil',
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CSV Upload', () => {
    it('should handle CSV upload with valid cards and render confirmation page', async () => {
      const owner = createUser({ following: ['user1'] });
      const cube = createCube({ owner });

      const csvContent = 'name,CMC,Type,Color,Rarity\nLightning Bolt,1,Instant,R,C';

      const mockCard = createMockCardFromCSV(
        createCardDetails({
          name: 'Lightning Bolt',
          scryfall_id: 'abcdefg-hijklmn',
        }),
      );

      setupBasicMocks();
      (cubefn.CSVtoCards as jest.Mock).mockReturnValue({
        newCards: [mockCard],
        newMaybe: [],
        cardsByBoard: { mainboard: [mockCard] },
        missing: [],
      });

      await bulkUpload(
        { user: owner, flash: flashMock, params: { id: cube.id }, body: {} } as any,
        {} as any,
        csvContent,
        cube,
      );

      // bulkUpload now always renders the confirmation page
      expect(render.render).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'BulkUploadPage',
        expect.objectContaining({
          added: ['abcdefg-hijklmn'],
          addedByBoard: { mainboard: ['abcdefg-hijklmn'] },
          missing: [],
        }),
      );
    });

    it('should handle CSV upload with board column grouping cards by board', async () => {
      const owner = createUser({ following: ['user1'] });
      const cube = createCube({ owner });

      const csvContent = 'name,CMC,Type,Color,board,Rarity\nLightning Bolt,1,Instant,R,mainboard,C\nHealingSalve,1,Instant,W,maybeboard,C';

      const mockCard1 = createMockCardFromCSV(
        createCardDetails({ name: 'Lightning Bolt', scryfall_id: 'bolt-id' }),
      );
      const mockCard2 = createMockCardFromCSV(
        createCardDetails({ name: 'Healing Salve', scryfall_id: 'salve-id' }),
      );

      setupBasicMocks();
      (cubefn.CSVtoCards as jest.Mock).mockReturnValue({
        newCards: [mockCard1],
        newMaybe: [mockCard2],
        cardsByBoard: { mainboard: [mockCard1], maybeboard: [mockCard2] },
        missing: [],
      });

      await bulkUpload(
        { user: owner, flash: flashMock, params: { id: cube.id }, body: {} } as any,
        {} as any,
        csvContent,
        cube,
      );

      expect(render.render).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'BulkUploadPage',
        expect.objectContaining({
          addedByBoard: { mainboard: ['bolt-id'], maybeboard: ['salve-id'] },
          missing: [],
        }),
      );
    });

    it('should handle CSV upload with missing cards', async () => {
      const owner = createUser();
      const cube = createCube({ owner });
      const csvContent = 'name,CMC,Type,Color,Rarity\nNotARealCard,1,Instant,R,C';

      setupBasicMocks();
      (cubefn.CSVtoCards as jest.Mock).mockReturnValue({
        newCards: [],
        newMaybe: [],
        cardsByBoard: {},
        missing: ['NotARealCard'],
      });

      await bulkUpload(
        { user: owner, flash: flashMock, params: { id: cube.id }, body: {} } as any,
        {} as any,
        csvContent,
        cube,
      );

      expect(render.render).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'BulkUploadPage',
        expect.objectContaining({
          added: [],
          missing: expect.arrayContaining(['NotARealCard']),
        }),
      );
    });

    it('should handle CSV upload with added and missing cards', async () => {
      const owner = createUser();
      const cube = createCube({ owner });
      const csvContent = 'name,CMC,Type,Color,Rarity\nNotARealCard,1,Instant,R,C\nLightning Bolt,1,Instant,R,C';

      const mockCard = createMockCardFromCSV(
        createCardDetails({
          name: 'Lightning Bolt',
          scryfall_id: 'abcdefg-hijklmn',
        }),
      );

      setupBasicMocks();
      (cubefn.CSVtoCards as jest.Mock).mockReturnValue({
        newCards: [mockCard],
        newMaybe: [],
        cardsByBoard: { mainboard: [mockCard] },
        missing: ['NotARealCard'],
      });

      await bulkUpload(
        { user: owner, flash: flashMock, params: { id: cube.id }, body: {} } as any,
        {} as any,
        csvContent,
        cube,
      );

      expect(render.render).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'BulkUploadPage',
        expect.objectContaining({
          added: ['abcdefg-hijklmn'],
          missing: expect.arrayContaining(['NotARealCard']),
        }),
      );
    });
  });

  describe('Text Upload', () => {
    it('should handle text upload with valid cards and render confirmation page', async () => {
      const owner = createUser({ following: ['user1'] });
      const cube = createCube({ owner });
      const textContent = '2x Lightning Bolt\nDark Ritual';

      const cards = ['Lightning Bolt', 'Dark Ritual'].map((name) =>
        createCardDetails({ name, scryfall_id: `${name.toLowerCase().replace(' ', '-')}-id` }),
      );

      setupBasicMocks();

      // Mock getMostReasonable for each card
      (carddb.getMostReasonable as jest.Mock)
        .mockReturnValueOnce(cards[0])
        .mockReturnValueOnce(cards[1]);

      // Mock cardFromId for detail lookups
      (carddb.cardFromId as jest.Mock)
        .mockReturnValueOnce(cards[0])
        .mockReturnValueOnce(cards[0])
        .mockReturnValueOnce(cards[1]);

      await bulkUpload(
        { user: owner, flash: flashMock, params: { id: cube.id }, body: { board: 'mainboard' } } as any,
        {} as any,
        textContent,
        cube,
      );

      // bulkUpload now always renders the confirmation page
      expect(render.render).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'BulkUploadPage',
        expect.objectContaining({
          addedByBoard: expect.objectContaining({
            mainboard: expect.any(Array),
          }),
        }),
      );
    });

    it('should handle text upload with set specifications', async () => {
      const owner = createUser({ following: ['user1'] });
      const cube = createCube({ owner });
      const textContent = 'Lightning Bolt (LEA) 123';

      setupBasicMocks();
      (carddb.getIdsFromName as jest.Mock).mockReturnValue(['bolt-id']);
      (carddb.cardFromId as jest.Mock).mockReturnValue({
        set: 'lea',
        collector_number: '123',
        name: 'Lightning Bolt',
        scryfall_id: 'bolt-id',
      });

      await bulkUpload(
        { user: owner, flash: flashMock, params: { id: cube.id }, body: { board: 'mainboard' } } as any,
        {} as any,
        textContent,
        cube,
      );

      expect(render.render).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'BulkUploadPage',
        expect.objectContaining({
          addedByBoard: expect.objectContaining({
            mainboard: ['bolt-id'],
          }),
        }),
      );
    });

    it('should handle text upload with missing cards', async () => {
      const owner = createUser({ following: ['user1'] });
      const cube = createCube({ owner });
      const textContent = 'NotARealCard\nAlsoNotReal';

      setupBasicMocks();
      (carddb.getMostReasonable as jest.Mock).mockReturnValue(null);

      await bulkUpload(
        { user: owner, flash: flashMock, params: { id: cube.id }, body: {} } as any,
        {} as any,
        textContent,
        cube,
      );

      expect(render.render).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'BulkUploadPage',
        expect.objectContaining({
          missing: expect.arrayContaining(['NotARealCard', 'AlsoNotReal']),
        }),
      );
    });

    it('should handle text upload with added and missing cards', async () => {
      const owner = createUser({ following: ['user1'] });
      const cube = createCube({ owner });
      const textContent = 'Healing Salve\nAlsoNotReal';

      const hsDetails = createCardDetails({
        name: 'Healing Salve',
        scryfall_id: 'healing-salve',
        error: false,
      });

      setupBasicMocks();

      // Mock getMostReasonable to return hsDetails for 'Healing Salve' and null for 'AlsoNotReal'
      (carddb.getMostReasonable as jest.Mock).mockReturnValueOnce(hsDetails).mockReturnValueOnce(null);

      // Mock cardFromId to always return hsDetails when called (since only healing-salve will be looked up)
      (carddb.cardFromId as jest.Mock).mockReturnValue(hsDetails);

      await bulkUpload(
        { user: owner, flash: flashMock, params: { id: cube.id }, body: { board: 'mainboard' } } as any,
        {} as any,
        textContent,
        cube,
      );

      expect(render.render).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'BulkUploadPage',
        expect.objectContaining({
          added: ['healing-salve'],
          addedByBoard: { mainboard: ['healing-salve'] },
          missing: expect.arrayContaining(['AlsoNotReal']),
        }),
      );
    });

    it('should use custom board from request body for text upload', async () => {
      const owner = createUser({ following: ['user1'] });
      const cube = createCube({ owner });
      const textContent = 'Lightning Bolt';

      const boltDetails = createCardDetails({
        name: 'Lightning Bolt',
        scryfall_id: 'bolt-id',
        error: false,
      });

      setupBasicMocks();
      (carddb.getMostReasonable as jest.Mock).mockReturnValue(boltDetails);
      (carddb.cardFromId as jest.Mock).mockReturnValue(boltDetails);

      await bulkUpload(
        { user: owner, flash: flashMock, params: { id: cube.id }, body: { board: 'maybeboard' } } as any,
        {} as any,
        textContent,
        cube,
      );

      expect(render.render).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'BulkUploadPage',
        expect.objectContaining({
          addedByBoard: { maybeboard: ['bolt-id'] },
        }),
      );
    });
  });
});
