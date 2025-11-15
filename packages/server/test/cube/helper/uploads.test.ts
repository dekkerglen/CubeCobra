import { FeedTypes } from '@utils/datatypes/Feed';
import * as carddb from 'serverutils/carddb';
import * as cubefn from 'serverutils/cubefn';
import * as render from 'serverutils/render';
import * as util from 'serverutils/util';

import Blog from '../../../src/dynamo/models/blog';
import Changelog from '../../../src/dynamo/models/changelog';
import Cube from '../../../src/dynamo/models/cube';
import Feed from '../../../src/dynamo/models/feed';
import { bulkUpload } from '../../../src/routes/cube/helper';
import { createCardDetails, createCube, createUser } from '../../test-utils/data';

jest.mock('../../../src/dynamo/models/cube');
jest.mock('../../../src/dynamo/models/blog');
jest.mock('../../../src/dynamo/models/changelog');
jest.mock('../../../src/dynamo/models/feed');
jest.mock('serverutils/carddb');
jest.mock('serverutils/cubefn');
jest.mock('serverutils/render');
jest.mock('serverutils/util');

describe('Bulk Upload', () => {
  const flashMock = jest.fn();

  const setupBasicMocks = (
    existingCards: { mainboard: any[]; maybeboard: any[] } = { mainboard: [], maybeboard: [] },
  ) => {
    (Cube.getCards as jest.Mock).mockResolvedValue(existingCards);
    (Changelog.put as jest.Mock).mockResolvedValue('changelog-id');
    (Blog.put as jest.Mock).mockResolvedValue('blog-id');
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

  const expectSuccessfulUpload = (owner: any, cube: any) => {
    expect(Blog.put).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: owner.id,
        cube: cube.id,
        title: expect.stringContaining('Cube Bulk Import'),
        changelist: 'changelog-id',
      }),
    );

    if (owner.following?.length) {
      expect(Feed.batchPut).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'blog-id',
            to: owner.following[0],
            type: FeedTypes.BLOG,
          }),
        ]),
      );
    }

    expect(flashMock).toHaveBeenCalledWith('success', 'All cards successfully added.');
  };

  const mockCardDBResponses = (cardDetails: any[]) => {
    cardDetails.forEach((details) => {
      (carddb.getMostReasonable as jest.Mock).mockReturnValueOnce(details);
      (carddb.cardFromId as jest.Mock).mockReturnValueOnce(details);
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CSV Upload', () => {
    it('should handle CSV upload with valid cards. Minimum 4 commas in the first line to detect as CSV', async () => {
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
      (cubefn.CSVtoCards as jest.Mock).mockReturnValue({ newCards: [mockCard], newMaybe: [], missing: [] });

      await bulkUpload({ user: owner, flash: flashMock, params: { id: cube.id } }, {}, csvContent, cube);

      expect(Cube.updateCards).toHaveBeenCalledWith(cube.id, {
        mainboard: [mockCard],
        maybeboard: [],
      });
      expectSuccessfulUpload(owner, cube);
    });

    it('should add valid cards in the CSV to existing cards in the cube', async () => {
      const owner = createUser({ following: ['user1'] });
      const cube = createCube({ owner });

      const csvContent = 'name,CMC,Type,Color,Rarity\nLightning Bolt,1,Instant,R,C';

      const mockCard = createMockCardFromCSV(
        createCardDetails({
          name: 'Lightning Bolt',
          scryfall_id: 'abcdefg-hijklmn',
        }),
      );

      const mockMainboardCard = createMockCardFromCSV(
        createCardDetails({
          name: 'Ancestral Recall',
          scryfall_id: 'red-blue',
        }),
      );

      const mockMaybeboardCard = createMockCardFromCSV(
        createCardDetails({
          name: 'Healing Salve',
          scryfall_id: 'bad-boy',
        }),
      );

      setupBasicMocks({
        mainboard: [mockMainboardCard],
        maybeboard: [mockMaybeboardCard],
      });
      (cubefn.CSVtoCards as jest.Mock).mockReturnValue({ newCards: [mockCard], newMaybe: [], missing: [] });

      await bulkUpload({ user: owner, flash: flashMock, params: { id: cube.id } }, {}, csvContent, cube);

      expect(Cube.updateCards).toHaveBeenCalledWith(cube.id, {
        mainboard: [mockMainboardCard, mockCard],
        maybeboard: [mockMaybeboardCard],
      });
      expectSuccessfulUpload(owner, cube);
    });

    it('should handle CSV upload with missing cards', async () => {
      const owner = createUser();
      const cube = createCube({ owner });
      const csvContent = 'name,CMC,Type,Color,Rarity\nNotARealCard,1,Instant,R,C';

      setupBasicMocks();
      (cubefn.CSVtoCards as jest.Mock).mockReturnValue({
        newCards: [],
        newMaybe: [],
        missing: ['NotARealCard'],
      });

      await bulkUpload({ user: owner, flash: flashMock, params: { id: cube.id } }, {}, csvContent, cube);

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
        missing: ['NotARealCard'],
      });

      await bulkUpload({ user: owner, flash: flashMock, params: { id: cube.id } }, {}, csvContent, cube);

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
    const mockAddCardToBoardImpl = (idToCardMap: Map<string, any>) => {
      return (board: any[], _cube: any, cardDetails: any) => {
        const card = idToCardMap.get(cardDetails.scryfall_id);
        if (card) board.push(card);
      };
    };

    it('should handle text upload with valid cards', async () => {
      const owner = createUser({ following: ['user1'] });
      const cube = createCube({ owner });
      const textContent = '2x Lightning Bolt\nDark Ritual';

      const cards = ['Lightning Bolt', 'Dark Ritual'].map((name) =>
        createCardDetails({ name, scryfall_id: `${name.toLowerCase().replace(' ', '-')}-id` }),
      );

      setupBasicMocks();
      mockCardDBResponses(cards);

      const mockCards = new Map(cards.map((card) => [card.scryfall_id, createMockCardFromCSV(card)]));

      ((util as any).addCardToCube as jest.Mock).mockImplementation(mockAddCardToBoardImpl(mockCards));

      await bulkUpload({ user: owner, flash: flashMock, params: { id: cube.id } }, {}, textContent, cube);
      expectSuccessfulUpload(owner, cube);
    });

    //TODO: Expand cases for multiple matches, none that match the set, etc
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
      });

      await bulkUpload({ user: owner, flash: flashMock, params: { id: cube.id } }, {}, textContent, cube);

      expect(Cube.updateCards).toHaveBeenCalled();
      expect(flashMock).toHaveBeenCalledWith('success', 'All cards successfully added.');
    });

    it('should handle text upload with missing cards', async () => {
      const owner = createUser({ following: ['user1'] });
      const cube = createCube({ owner });
      const textContent = 'NotARealCard\nAlsoNotReal';

      setupBasicMocks();
      (carddb.getMostReasonable as jest.Mock).mockReturnValue(null);

      await bulkUpload({ user: owner, flash: flashMock, params: { id: cube.id } }, {}, textContent, cube);

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
      });

      const mockHsCard = createMockCardFromCSV(hsDetails);

      setupBasicMocks();
      mockCardDBResponses([hsDetails, null]);

      ((util as any).addCardToCube as jest.Mock).mockImplementation(
        mockAddCardToBoardImpl(new Map([[hsDetails.scryfall_id, mockHsCard]])),
      );

      await bulkUpload({ user: owner, flash: flashMock, params: { id: cube.id } }, {}, textContent, cube);

      expect(render.render).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'BulkUploadPage',
        expect.objectContaining({
          added: ['healing-salve'],
          missing: expect.arrayContaining(['AlsoNotReal']),
        }),
      );
    });
  });
});
