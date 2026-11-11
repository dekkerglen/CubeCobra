import { createRecordFromDraftHandler } from '../../../src/router/routes/cube/records/create';
import { createCube } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('serverutils/render', () => ({
  ...jest.requireActual('serverutils/render'),
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
}));

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: { getById: jest.fn() },
  draftDao: { getById: jest.fn() },
  recordDao: { createRecord: jest.fn() },
}));

import { cubeDao, draftDao, recordDao } from '../../../src/dynamo/daos';

describe('createRecordFromDraftHandler', () => {
  const cube = createCube({ id: 'my-cube' });
  const flash = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (recordDao.createRecord as jest.Mock).mockResolvedValue('rec-1');
  });

  const createFrom = (seats: unknown[]) => {
    (draftDao.getById as jest.Mock).mockResolvedValue({ id: 'draft-1', cube: cube.id, seats });
    return call(createRecordFromDraftHandler)
      .as(cube.owner)
      .withFlash(flash)
      .withParams({ id: cube.id })
      .withBody({ record: JSON.stringify({ name: 'Friday Draft' }), draft: 'draft-1' })
      .send();
  };

  const playerNames = () => (recordDao.createRecord as jest.Mock).mock.calls[0][0].players.map((p: any) => p.name);

  it('names a seat after its owner', async () => {
    await createFrom([{ owner: { id: 'u1', username: 'alice' } }]);

    expect(playerNames()).toEqual(['alice']);
  });

  it('uses the external player name when a seat has no account', async () => {
    await createFrom([{ playerName: 'Carol from the LGS' }]);

    expect(playerNames()).toEqual(['Carol from the LGS']);
  });

  // A record's players must be uniquely named — edit/players.ts refuses to save a
  // duplicate — so a draft full of ownerless bot seats would otherwise produce a
  // record whose player list could never be edited.
  it('disambiguates the ownerless seats of a bot draft', async () => {
    await createFrom([{ owner: { id: 'u1', username: 'alice' } }, {}, {}, {}]);

    expect(playerNames()).toEqual(['alice', 'Unknown Player', 'Unknown Player 2', 'Unknown Player 3']);
  });

  it('disambiguates two external players sharing a name', async () => {
    await createFrom([{ playerName: 'Alex' }, { playerName: 'Alex' }]);

    expect(playerNames()).toEqual(['Alex', 'Alex 2']);
  });

  it('disambiguates case-insensitively, matching the uniqueness rule for edits', async () => {
    await createFrom([{ playerName: 'Alex' }, { playerName: 'alex' }]);

    expect(playerNames()).toEqual(['Alex', 'alex 2']);
  });

  it('leaves already-unique names alone', async () => {
    await createFrom([{ playerName: 'Alex' }, { playerName: 'Blake' }]);

    expect(playerNames()).toEqual(['Alex', 'Blake']);
  });

  it('keeps one player per seat so the record stays aligned with the draft', async () => {
    await createFrom([{}, {}, {}, {}, {}, {}, {}, {}]);

    expect(playerNames()).toHaveLength(8);
    expect(new Set(playerNames()).size).toBe(8);
  });
});
