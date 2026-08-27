jest.mock('serverutils/carddb', () => ({
  cardFromId: jest.fn(() => ({ type: 'Creature', color_identity: ['U'], oracle_id: 'oracle-1' })),
}));

jest.mock('serverutils/archetype', () => ({
  classifyDeck: jest.fn(async () => 'Tempo'),
}));

jest.mock('../../src/dynamo/s3client', () => ({
  getObject: jest.fn(),
  getObjectWithETag: jest.fn(),
  putObject: jest.fn(),
  putObjectIfMatch: jest.fn(),
}));

import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

import { CubeDynamoDao } from '../../src/dynamo/dao/CubeDynamoDao';
import { DraftDynamoDao } from '../../src/dynamo/dao/DraftDynamoDao';
import { UserDynamoDao } from '../../src/dynamo/dao/UserDynamoDao';
import { getObject, getObjectWithETag, putObject, putObjectIfMatch } from '../../src/dynamo/s3client';

const TABLE = 'TEST_TABLE';
const DRAFT_ID = 'draft-1';
const KEY = { PK: `DRAFT#${DRAFT_ID}`, SK: 'DRAFT' };

// One human seat and one bot seat, the bot holding the naive layout the finish route wrote.
const naiveSeats = () => ({
  seats: [
    { bot: false, name: 'U Tempo', mainboard: [[[0]]], sideboard: [[[1]]] },
    { bot: true, name: 'U', mainboard: [[[2, 3, 4]]], sideboard: [[[]]] },
  ],
  basics: [],
  InitialState: [],
});

const builtBotSeat = {
  seatIndex: 1,
  mainboard: [[[2, 3]]],
  sideboard: [[[4]]],
  name: 'UB Control',
};

const storedItem = (overrides: Record<string, any> = {}) => ({
  ...KEY,
  DynamoVersion: 7,
  item: {
    id: DRAFT_ID,
    cube: 'cube-1',
    type: 'd',
    name: 'U Tempo Draft of Test Cube',
    seatNames: ['U Tempo', 'U'],
    complete: true,
    dateLastUpdated: 1,
    botDecksPending: true,
    botDecksPendingSince: 1,
    ...overrides,
  },
});

describe('DraftDynamoDao bot-deck writes', () => {
  let send: jest.Mock;
  let dao: DraftDynamoDao;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATA_BUCKET = 'test-bucket';

    send = jest.fn(async (command: any) => (command instanceof GetCommand ? { Item: storedItem() } : {}));
    dao = new DraftDynamoDao({ send } as any, {} as CubeDynamoDao, {} as UserDynamoDao, TABLE);

    (getObjectWithETag as jest.Mock).mockResolvedValue({ value: naiveSeats(), etag: '"v1"' });
    (putObjectIfMatch as jest.Mock).mockResolvedValue(true);
    (getObject as jest.Mock).mockResolvedValue([{ cardID: 'c0' }, { cardID: 'c1' }, { cardID: 'c2' }]);
  });

  const puts = () => send.mock.calls.map(([command]) => command).filter((c: any) => c instanceof PutCommand);

  describe('applyBuiltBotDecks', () => {
    it('writes the seats blob conditionally on the version it read', async () => {
      await dao.applyBuiltBotDecks(DRAFT_ID, [builtBotSeat]);

      const [, , seatsWritten, etag] = (putObjectIfMatch as jest.Mock).mock.calls[0];
      expect(etag).toBe('"v1"');
      expect(seatsWritten.seats[1]).toMatchObject({ mainboard: builtBotSeat.mainboard, name: 'UB Control' });
      // The player's own seat is left exactly as it was found.
      expect(seatsWritten.seats[0]).toMatchObject({ mainboard: [[[0]]], name: 'U Tempo' });
    });

    // The bug: the old write-back put the record back with the DynamoVersion it read, so it
    // neither checked for a concurrent writer nor announced itself to one.
    it('bumps DynamoVersion and guards the metadata write', async () => {
      await dao.applyBuiltBotDecks(DRAFT_ID, [builtBotSeat]);

      const put = puts()[0]!;
      expect(put.input.Item).toMatchObject({ DynamoVersion: 8 });
      expect(put.input.ConditionExpression).toContain('DynamoVersion = :expectedVersion');
      expect(put.input.ExpressionAttributeValues).toEqual({ ':expectedVersion': 7 });
      expect(put.input.Item!.item).toMatchObject({
        botDecksPending: false,
        seatNames: ['U Tempo', 'UB Control'],
      });
    });

    it('re-reads and re-applies when the seats blob changed under it', async () => {
      (putObjectIfMatch as jest.Mock).mockResolvedValueOnce(false);

      await dao.applyBuiltBotDecks(DRAFT_ID, [builtBotSeat]);

      expect(getObjectWithETag).toHaveBeenCalledTimes(2);
      expect(putObjectIfMatch).toHaveBeenCalledTimes(2);
    });
  });

  describe('applySeatEdit', () => {
    const edit = { mainboard: [[[0, 1]]], sideboard: [[[2]]], title: '', body: '' };

    it('writes only the edited seat, leaving bot decks alone', async () => {
      await dao.applySeatEdit(DRAFT_ID, 0, edit);

      const [, , seatsWritten] = (putObjectIfMatch as jest.Mock).mock.calls[0];
      expect(seatsWritten.seats[0]).toMatchObject({ mainboard: [[[0, 1]]], sideboard: [[[2]]] });
      expect(seatsWritten.seats[1]).toEqual(naiveSeats().seats[1]);
    });

    // The regression: a deck save used to write the whole draft back, re-setting the pending
    // flag it had hydrated before the build finished — with nothing left in the queue to clear
    // it again.
    it('never writes bot-deck state', async () => {
      send.mockImplementation(async (command: any) =>
        command instanceof GetCommand ? { Item: storedItem({ botDecksPending: false, botDecksPendingSince: 2 }) } : {},
      );

      await dao.applySeatEdit(DRAFT_ID, 0, edit);

      expect(puts()[0]!.input.Item!.item).toMatchObject({ botDecksPending: false, botDecksPendingSince: 2 });
    });

    it('renames only the edited seat', async () => {
      await dao.applySeatEdit(DRAFT_ID, 0, edit);

      const item = puts()[0]!.input.Item!.item;
      expect(item.seatNames).toEqual(['U Tempo', 'U']);
      expect(item.name).toBe('U Tempo Draft of Test Cube');
    });

    it('keeps a user-supplied deck name and does not regenerate one', async () => {
      await dao.applySeatEdit(DRAFT_ID, 0, { ...edit, title: 'Mono U Flyers' });

      const item = puts()[0]!.input.Item!.item;
      expect(item.name).toBe('Mono U Flyers');
      expect(item.seatNames).toEqual(['U Tempo', 'U']);
    });

    it('appends cards added in the deckbuilder to the pool', async () => {
      await dao.applySeatEdit(DRAFT_ID, 0, { ...edit, newCards: [{ cardID: 'c3' }] });

      const [, key, written] = (putObject as jest.Mock).mock.calls[0];
      expect(key).toBe(`cardlist/${DRAFT_ID}.json`);
      expect(written).toHaveLength(4);
      expect(written[3]).toMatchObject({ cardID: 'c3', index: 3 });
    });

    it('drops board indices that no longer resolve to a card', async () => {
      await dao.applySeatEdit(DRAFT_ID, 0, { ...edit, mainboard: [[[0, 99]]] });

      const [, , seatsWritten] = (putObjectIfMatch as jest.Mock).mock.calls[0];
      expect(seatsWritten.seats[0].mainboard).toEqual([[[0]]]);
    });
  });

  describe('update', () => {
    it('carries stored bot-deck state forward rather than the caller stale copy', async () => {
      const stale = {
        id: DRAFT_ID,
        cube: 'cube-1',
        type: 'd',
        name: 'U Tempo Draft of Test Cube',
        seats: [{ title: 'Mono U Flyers', mainboard: [[[0]]], sideboard: [[[1]]] }],
        cards: [],
        // Hydrated while the build was still in flight.
        botDecksPending: true,
        botDecksPendingSince: 1,
      } as any;

      send.mockImplementation(async (command: any) =>
        command instanceof GetCommand ? { Item: storedItem({ botDecksPending: false, botDecksPendingSince: 2 }) } : {},
      );

      await dao.update(stale);

      expect(puts()[0]!.input.Item!.item).toMatchObject({ botDecksPending: false, botDecksPendingSince: 2 });
    });
  });
});
