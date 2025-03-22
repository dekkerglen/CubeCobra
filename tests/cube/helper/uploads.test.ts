import { FeedTypes } from '../../../src/datatypes/Feed';
import Blog from '../../../src/dynamo/models/blog';
import Changelog from '../../../src/dynamo/models/changelog';
import Cube from '../../../src/dynamo/models/cube';
import Feed from '../../../src/dynamo/models/feed';
import { bulkUpload } from '../../../src/routes/cube/helper';
import * as carddb from '../../../src/util/carddb';
import * as cubefn from '../../../src/util/cubefn';
import * as render from '../../../src/util/render';
import * as util from '../../../src/util/util';
import { createCardDetails, createCube, createUser } from '../../test-utils/data';

jest.mock('../../../src/dynamo/models/cube');
jest.mock('../../../src/dynamo/models/blog');
jest.mock('../../../src/dynamo/models/changelog');
jest.mock('../../../src/dynamo/models/feed');
jest.mock('../../../src/util/carddb');
jest.mock('../../../src/util/cubefn');
jest.mock('../../../src/util/render');
jest.mock('../../../src/util/util');

describe('Bulk Upload', () => {
  const flashMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CSV Upload', () => {
    it('should handle CSV upload with valid cards. Minimum 4 commas in the first line to detect as CSV', async () => {
      const owner = createUser({ following: ['user1'] });
      const cube = createCube({ owner });

      const csvContent = 'name,CMC,Type,Color,Rarity\nLightning Bolt,1,Instant,R,C';

      //No defined type for this
      const mockCard = {
        name: 'Lightning Bolt',
        cmc: 1,
        type_line: 'Instant',
        colors: ['R'],
        addedTmsp: new Date().valueOf().toString(),
        cardID: 'abcdefg-hijklmn',
      };

      (Cube.getCards as jest.Mock).mockResolvedValue({ mainboard: [], maybeboard: [] });
      (Changelog.put as jest.Mock).mockResolvedValue('changelog-id');
      (Blog.put as jest.Mock).mockResolvedValue('blog-id');
      (cubefn.CSVtoCards as jest.Mock).mockReturnValue({ newCards: [mockCard], newMaybe: [], missing: [] });

      await bulkUpload({ user: owner, flash: flashMock, params: { id: cube.id } }, {}, csvContent, cube);

      expect(Cube.updateCards).toHaveBeenCalledWith(cube.id, {
        mainboard: [mockCard],
        maybeboard: [],
      });
      expect(Changelog.put).toHaveBeenCalledWith(
        {
          mainboard: {
            adds: [{ cardID: 'abcdefg-hijklmn' }],
          },
        },
        cube.id,
      );
      expect(Blog.put).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: owner.id,
          cube: cube.id,
          title: expect.stringContaining('Cube Bulk Import'),
          changelist: 'changelog-id',
        }),
      );
      expect(Feed.batchPut).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'blog-id',
            to: 'user1',
            type: FeedTypes.BLOG,
          }),
        ]),
      );
      expect(flashMock).toHaveBeenCalledWith('success', 'All cards successfully added.');
    });

    it('should add valid cards in the CSV to existing cards in the cube', async () => {
      const owner = createUser({ following: ['user1'] });
      const cube = createCube({ owner });

      const csvContent = 'name,CMC,Type,Color,Rarity\nLightning Bolt,1,Instant,R,C';

      //No defined type for this
      const mockCard = {
        name: 'Lightning Bolt',
        cmc: 1,
        type_line: 'Instant',
        colors: ['R'],
        addedTmsp: new Date().valueOf().toString(),
        cardID: 'abcdefg-hijklmn',
      };

      const mockMainboardCard = {
        name: 'Ancestral Recall',
        cmc: 1,
        type_line: 'Instant',
        colors: ['U'],
        addedTmsp: '1742649530000',
        cardID: 'red-blue',
      };

      const mockMaybeboardCard = {
        name: 'Healing Salve',
        cmc: 1,
        type_line: 'Instant',
        colors: ['W'],
        addedTmsp: '1742649580000',
        cardID: 'bad-boy',
      };

      (Cube.getCards as jest.Mock).mockResolvedValue({
        mainboard: [mockMainboardCard],
        maybeboard: [mockMaybeboardCard],
      });
      (Changelog.put as jest.Mock).mockResolvedValue('changelog-id');
      (Blog.put as jest.Mock).mockResolvedValue('blog-id');
      (cubefn.CSVtoCards as jest.Mock).mockReturnValue({ newCards: [mockCard], newMaybe: [], missing: [] });

      await bulkUpload({ user: owner, flash: flashMock, params: { id: cube.id } }, {}, csvContent, cube);

      expect(Cube.updateCards).toHaveBeenCalledWith(cube.id, {
        mainboard: [mockMainboardCard, mockCard],
        maybeboard: [mockMaybeboardCard],
      });
      expect(Changelog.put).toHaveBeenCalledWith(
        {
          mainboard: {
            adds: [{ cardID: 'abcdefg-hijklmn' }],
          },
        },
        cube.id,
      );
      expect(Blog.put).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: owner.id,
          cube: cube.id,
          title: expect.stringContaining('Cube Bulk Import'),
          changelist: 'changelog-id',
        }),
      );
      expect(Feed.batchPut).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'blog-id',
            to: 'user1',
            type: FeedTypes.BLOG,
          }),
        ]),
      );
      expect(flashMock).toHaveBeenCalledWith('success', 'All cards successfully added.');
    });

    it('should handle CSV upload with missing cards', async () => {
      const owner = createUser();
      const cube = createCube({ owner });
      const csvContent = 'name,CMC,Type,Color,Rarity\nNotARealCard,1,Instant,R,C';

      (Cube.getCards as jest.Mock).mockResolvedValue({ mainboard: [], maybeboard: [] });
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

      const mockCard = {
        name: 'Lightning Bolt',
        cmc: 1,
        type_line: 'Instant',
        colors: ['R'],
        addedTmsp: new Date().valueOf().toString(),
        cardID: 'abcdefg-hijklmn',
      };

      (Cube.getCards as jest.Mock).mockResolvedValue({ mainboard: [], maybeboard: [] });
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
    const mockAddCardToBoardImpl = (
      idToCardMap: Map<string, any>,
    ): ((board: any, _cube: any, cardDetails: any) => void) => {
      return (board, _cube, cardDetails) => {
        const id = cardDetails.scryfall_id;
        if (idToCardMap.has(id)) {
          board.push(idToCardMap.get(id));
        }
      };
    };

    it('should handle text upload with valid cards', async () => {
      const owner = createUser({ following: ['user1'] });
      const cube = createCube({ owner });
      const textContent = '2x Lightning Bolt\nDark Ritual';

      const lbDetails = createCardDetails({
        name: 'Lightning Bolt',
        scryfall_id: 'bolt-id',
      });

      const mockLbCard = {
        tags: [],
        status: 'Owned',
        colors: lbDetails.color_identity,
        cmc: lbDetails.cmc,
        cardID: lbDetails.scryfall_id,
        type_line: lbDetails.type,
        addedTmsp: new Date(),
        finish: 'Non-foil',
      };

      const drDetails = createCardDetails({
        name: 'Dark Ritual',
        scryfall_id: 'dark-rit',
      });

      const mockDrCard = {
        tags: [],
        status: 'Owned',
        colors: drDetails.color_identity,
        cmc: drDetails.cmc,
        cardID: drDetails.scryfall_id,
        type_line: drDetails.type,
        addedTmsp: new Date(),
        finish: 'Non-foil',
      };

      (Cube.getCards as jest.Mock).mockResolvedValue({ mainboard: [], maybeboard: [] });
      (carddb.getMostReasonable as jest.Mock).mockReturnValueOnce(lbDetails);
      (carddb.getMostReasonable as jest.Mock).mockReturnValueOnce(drDetails);
      (carddb.cardFromId as jest.Mock).mockReturnValueOnce(lbDetails);
      (carddb.cardFromId as jest.Mock).mockReturnValueOnce(drDetails);
      (Changelog.put as jest.Mock).mockResolvedValue('changelog-id');
      (util.addCardToCube as jest.Mock).mockImplementation(
        mockAddCardToBoardImpl(
          new Map([
            [lbDetails.scryfall_id, mockLbCard],
            [drDetails.scryfall_id, mockDrCard],
          ]),
        ),
      );

      await bulkUpload({ user: owner, flash: flashMock, params: { id: cube.id } }, {}, textContent, cube);

      expect(Cube.updateCards).toHaveBeenCalledWith(cube.id, {
        mainboard: [mockLbCard, mockLbCard, mockDrCard],
        maybeboard: [],
      });
      expect(Changelog.put).toHaveBeenCalledWith(
        {
          mainboard: {
            adds: [{ cardID: 'bolt-id' }, { cardID: 'bolt-id' }, { cardID: 'dark-rit' }],
          },
        },
        cube.id,
      );
      expect(Blog.put).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: owner.id,
          cube: cube.id,
          title: expect.stringContaining('Cube Bulk Import'),
          changelist: 'changelog-id',
        }),
      );
      expect(Feed.batchPut).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'blog-id',
            to: 'user1',
            type: FeedTypes.BLOG,
          }),
        ]),
      );
      expect(flashMock).toHaveBeenCalledWith('success', 'All cards successfully added.');
    });

    //TODO: Expand on
    it('should handle text upload with set specifications', async () => {
      const owner = createUser({ following: ['user1'] });
      const cube = createCube({ owner });
      const textContent = 'Lightning Bolt (LEA) 123';

      (Cube.getCards as jest.Mock).mockResolvedValue({ mainboard: [], maybeboard: [] });
      (carddb.getIdsFromName as jest.Mock).mockReturnValue(['bolt-id']);
      (carddb.cardFromId as jest.Mock).mockReturnValue({
        set: 'lea',
        collector_number: '123',
        name: 'Lightning Bolt',
      });
      (Changelog.put as jest.Mock).mockResolvedValue('changelog-id');

      await bulkUpload({ user: owner, flash: flashMock, params: { id: cube.id } }, {}, textContent, cube);

      expect(Cube.updateCards).toHaveBeenCalled();
      expect(flashMock).toHaveBeenCalledWith('success', 'All cards successfully added.');
    });

    it('should handle text upload with missing cards', async () => {
      const owner = createUser({ following: ['user1'] });
      const cube = createCube({ owner });
      const textContent = 'NotARealCard\nAlsoNotReal';

      (Cube.getCards as jest.Mock).mockResolvedValue({ mainboard: [], maybeboard: [] });
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

      const mockHsCard = {
        tags: [],
        status: 'Owned',
        colors: hsDetails.color_identity,
        cmc: hsDetails.cmc,
        cardID: hsDetails.scryfall_id,
        type_line: hsDetails.type,
        addedTmsp: new Date(),
        finish: 'Non-foil',
      };

      (Cube.getCards as jest.Mock).mockResolvedValue({ mainboard: [], maybeboard: [] });
      (carddb.getMostReasonable as jest.Mock).mockReturnValueOnce(hsDetails);
      (carddb.getMostReasonable as jest.Mock).mockReturnValueOnce(null);
      (carddb.cardFromId as jest.Mock).mockReturnValueOnce(hsDetails);
      (carddb.cardFromId as jest.Mock).mockReturnValueOnce(null);

      (util.addCardToCube as jest.Mock).mockImplementation(
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
