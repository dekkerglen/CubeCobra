import { contributeSubmitHandler } from '../../../src/router/routes/cube/records/contribute';
import { createCube } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('serverutils/render', () => ({
  ...jest.requireActual('serverutils/render'),
  redirect: jest.fn(),
  handleRouteError: jest.fn((_req, _res, err) => {
    throw err;
  }),
}));

jest.mock('serverutils/recordShareToken', () => ({
  verifyRecordToken: jest.fn(() => true),
}));

// Attaching the deck is uploaddeck's job and is covered by its own suites; this one is about
// whether the player is allowed to be added at all.
jest.mock('../../../src/router/routes/cube/records/uploaddeck', () => ({
  associateNewDraft: jest.fn(),
  associateWithExistingDraft: jest.fn(),
}));

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: { getById: jest.fn() },
  draftDao: { getById: jest.fn(), update: jest.fn() },
  recordDao: { getById: jest.fn(), update: jest.fn() },
  userDao: { getByUsername: jest.fn() },
}));

import { cubeDao, draftDao, recordDao, userDao } from '../../../src/dynamo/daos';

/**
 * Matches, trophies and overrides are all keyed by player name, so two players sharing one
 * makes their results indistinguishable — which is why the transcription workspace refuses a
 * duplicate and the contribute page's own rename path refuses one too.
 *
 * Adding a player was the gap: a contributor could submit a name already in the record and
 * get a second entry under it, from the one write path in this tree that needs no account.
 */
describe('contribute: adding a player', () => {
  const cube = createCube({ id: 'my-cube' });
  const flash = jest.fn();

  const record = () => ({
    id: 'rec-1',
    cube: cube.id,
    players: [{ name: 'Alice' }, { name: 'Bob' }],
    matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] }] }],
    trophy: ['Alice'],
    overrides: { Alice: { wins: 2, losses: 1, draws: 0 } },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (recordDao.getById as jest.Mock).mockResolvedValue(record());
    (userDao.getByUsername as jest.Mock).mockResolvedValue(null);
  });

  const contribute = (newPlayer: string) =>
    call(contributeSubmitHandler)
      .withParams({ id: 'rec-1' })
      .withFlash(flash)
      .withBody({
        token: 'a-token',
        userIndex: '-1',
        newPlayer,
        mainboard: JSON.stringify(['card-a']),
        sideboard: '[]',
        wins: '1',
        losses: '0',
        draws: '0',
      })
      .send();

  it('refuses a name the record already holds, writing nothing', async () => {
    await contribute('Alice');

    expect(flash).toHaveBeenCalledWith('danger', expect.stringMatching(/already named Alice/i));
    expect(recordDao.update).not.toHaveBeenCalled();
    expect(draftDao.update).not.toHaveBeenCalled();
  });

  // The same comparison the rename path and the workspace use: two names differing only in
  // case are indistinguishable everywhere results are keyed by name.
  it('refuses a name that collides only in case', async () => {
    await contribute('alice');

    expect(flash).toHaveBeenCalledWith('danger', expect.stringMatching(/already named/i));
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('refuses a collision reached through an @handle', async () => {
    (userDao.getByUsername as jest.Mock).mockResolvedValue({ id: 'user-bob', username: 'Bob' });

    await contribute('@Bob');

    expect(flash).toHaveBeenCalledWith('danger', expect.stringMatching(/already named/i));
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('still adds a name the record does not hold', async () => {
    await contribute('Carol');

    expect(flash).not.toHaveBeenCalledWith('danger', expect.stringMatching(/already named/i));
    expect(recordDao.update).toHaveBeenCalled();
    const written = (recordDao.update as jest.Mock).mock.calls[0][0];
    expect(written.players.map((player: { name: string }) => player.name)).toEqual(['Alice', 'Bob', 'Carol']);
  });
});
