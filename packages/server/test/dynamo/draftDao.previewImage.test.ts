jest.mock('serverutils/carddb', () => ({
  cardFromId: jest.fn((id: string) => ({
    type: 'Creature',
    color_identity: ['U'],
    oracle_id: `oracle-${id}`,
    art_crop: id === 'custom' ? undefined : `art-${id}`,
  })),
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
import { getObject, getObjectWithETag, putObjectIfMatch } from '../../src/dynamo/s3client';

const TABLE = 'TEST_TABLE';
const CARDS = [{ cardID: 'a' }, { cardID: 'b' }, { cardID: 'custom' }];

describe('DraftDynamoDao previewImage', () => {
  let dao: DraftDynamoDao;
  let stored: Record<string, any> | undefined;
  let seatsBlob: any;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATA_BUCKET = 'test-bucket';
    stored = undefined;
    seatsBlob = { seats: [{ mainboard: [[[]]], sideboard: [[[]]], pickorder: [] }] };

    const send = jest.fn(async (command: any) => {
      if (command instanceof PutCommand) {
        stored = command.input.Item;
        return {};
      }
      if (command instanceof GetCommand) {
        return { Item: stored };
      }
      return {};
    });
    const cubeDao = { getById: jest.fn(async () => ({ name: 'Test Cube' })) } as unknown as CubeDynamoDao;
    const userDao = {
      getById: jest.fn(async (id: string) => ({ id, username: id })),
      batchGet: jest.fn(async () => []),
    } as unknown as UserDynamoDao;
    dao = new DraftDynamoDao({ send } as any, cubeDao, userDao, TABLE);

    (getObject as jest.Mock).mockImplementation(async (_bucket: string, key: string) =>
      key.startsWith('cardlist/') ? CARDS : seatsBlob,
    );
    (getObjectWithETag as jest.Mock).mockImplementation(async () => ({ value: seatsBlob, etag: 'e' }));
    (putObjectIfMatch as jest.Mock).mockImplementation(async () => true);
  });

  // Mirrors /draft/finish: an in-progress draft gets its pick order and is saved complete.
  const finishDraft = async (pickorder: number[], seatOverrides: Record<string, unknown> = {}) => {
    seatsBlob.seats[0] = { ...seatsBlob.seats[0], ...seatOverrides };
    const id = await dao.createDraft({
      seats: [{ mainboard: [[[]]], sideboard: [[[]]], pickorder: [], ...seatOverrides }],
      cards: CARDS,
      cube: 'cube-1',
      cubeOwner: 'owner-1',
      owner: 'owner-1',
      type: 'd',
      complete: false,
    });
    const draft = (await dao.getById(id))!;
    draft.seats[0]!.pickorder = pickorder;
    draft.complete = true;
    await dao.update(draft);
    return id;
  };

  it("uses the drafter's first pick when the draft is finished", async () => {
    const id = await finishDraft([1, 0]);

    expect(stored!.item.previewImage).toBe('art-b');
    expect((await dao.getById(id))!.previewImage).toBe('art-b');
  });

  it('falls back to the first pick for decks saved before preview images existed', async () => {
    const id = await finishDraft([1, 0]);
    delete stored!.item.previewImage;
    seatsBlob.seats[0].pickorder = [1, 0];

    expect((await dao.getById(id))!.previewImage).toBe('art-b');
  });

  it('leaves it unset when the first pick has no art, so the cube image is used', async () => {
    await finishDraft([2, 0]);

    expect(stored!.item.previewImage).toBeUndefined();
  });

  it('skips bot seats', async () => {
    await finishDraft([0], { bot: true });

    expect(stored!.item.previewImage).toBeUndefined();
  });

  it('keeps an image the user chose when the draft is saved again', async () => {
    const id = await finishDraft([1, 0]);
    await dao.applySeatEdit(id, 0, { mainboard: [[[]]], sideboard: [[[]]], title: '', body: '', previewCardID: 'a' });
    expect(stored!.item.previewImage).toBe('art-a');

    const draft = (await dao.getById(id))!;
    await dao.update(draft);

    expect(stored!.item.previewImage).toBe('art-a');
  });

  it("ignores a chosen card that isn't in the deck's pool", async () => {
    const id = await finishDraft([1, 0]);
    await dao.applySeatEdit(id, 0, { mainboard: [[[]]], sideboard: [[[]]], title: '', body: '', previewCardID: 'z' });

    expect(stored!.item.previewImage).toBe('art-b');
  });
});
