import { addRoundHandler, removeRoundHandler } from '../../../src/router/routes/cube/records/edit/round';
import { createCube } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('serverutils/render', () => ({
  ...jest.requireActual('serverutils/render'),
  redirect: jest.fn(),
}));

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: { getById: jest.fn() },
  recordDao: { getById: jest.fn(), update: jest.fn() },
}));

import { cubeDao, recordDao } from '../../../src/dynamo/daos';

describe('cube/records/edit/round', () => {
  const cube = createCube({ id: 'my-cube' });
  const flash = jest.fn();
  const record = () => ({
    id: 'rec-1',
    cube: cube.id,
    players: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }, { name: 'Dave' }],
    matches: [
      {
        matches: [
          { p1: 'Alice', p2: 'Bob', results: [2, 0, 0] },
          { p1: 'Carol', p2: 'Dave', results: [2, 0, 0] },
        ],
      },
    ],
    trophy: [],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (recordDao.getById as jest.Mock).mockResolvedValue(record());
  });

  const send = (handler: any, body: object) =>
    call(handler).as(cube.owner).withFlash(flash).withParams({ id: 'rec-1' }).withBody(body).send();
  const round = (matches: [string, string][]) =>
    JSON.stringify({ matches: matches.map(([p1, p2]) => ({ p1, p2, results: [0, 0, 0] })) });

  it('adds a round paired from the rounds it expects', async () => {
    await send(addRoundHandler, {
      round: round([
        ['Alice', 'Carol'],
        ['Bob', 'Dave'],
      ]),
      expectedRounds: '1',
    });

    expect((recordDao.update as jest.Mock).mock.calls[0][0].matches).toHaveLength(2);
  });

  it('refuses a round paired before another device added one', async () => {
    await send(addRoundHandler, { round: round([['Alice', 'Carol']]), expectedRounds: '0' });

    expect(recordDao.update).not.toHaveBeenCalled();
    expect(flash).toHaveBeenCalledWith('danger', expect.stringContaining('out of date'));
  });

  it('refuses a round with a player in two matches, or against themselves', async () => {
    await send(addRoundHandler, {
      round: round([
        ['Alice', 'Bob'],
        ['Bob', 'Bob'],
      ]),
    });

    expect(recordDao.update).not.toHaveBeenCalled();
    expect(flash).toHaveBeenCalledWith('danger', expect.stringContaining('Bob is paired against themselves.'));
    expect(flash).toHaveBeenCalledWith('danger', expect.stringContaining('Bob is in more than one match.'));
  });

  it('still takes a round of placeholders, for matches entered before the players are known', async () => {
    await send(addRoundHandler, {
      round: round([
        ['Unknown Opponent', 'Unknown Opponent'],
        ['Unknown Opponent', 'Unknown Opponent'],
      ]),
    });

    expect(recordDao.update).toHaveBeenCalledTimes(1);
  });

  it('refuses to remove a round from a page that missed a change to the rounds', async () => {
    await send(removeRoundHandler, { roundIndex: '0', expectedRounds: '2' });

    expect(recordDao.update).not.toHaveBeenCalled();
  });
});
