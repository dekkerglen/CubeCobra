import { SynergyConnectPuzzle, SynergyConnectSubmission } from '@utils/datatypes/SynergyConnect';

import { guessSynergyConnectHandler } from '../../../src/router/routes/tool/api/synergyconnect/guess';
import { createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  ...jest.requireActual('../../../src/dynamo/daos'),
  synergyConnectPuzzleDao: { getByDate: jest.fn() },
  synergyConnectSubmissionDao: { getByUserAndDate: jest.fn(), createSubmission: jest.fn(), update: jest.fn() },
  synergyConnectUserStatsDao: { getByUserId: jest.fn(), createUserStats: jest.fn(), update: jest.fn() },
}));

import {
  synergyConnectPuzzleDao,
  synergyConnectSubmissionDao,
  synergyConnectUserStatsDao,
} from '../../../src/dynamo/daos';

const DATE = '2026-09-26';
const card = (name: string) => ({ name, oracleId: `oracle-${name}` });

const createPuzzle = (overrides?: Partial<SynergyConnectPuzzle>): SynergyConnectPuzzle => ({
  id: DATE,
  type: 'HISTORY',
  date: DATE,
  theme: { filterText: 'keyword:Flying', description: 'with Flying' },
  groups: [
    { commander: card('Commander A'), cards: [card('a1'), card('a2'), card('a3'), card('a4')] },
    { commander: card('Commander B'), cards: [card('b1'), card('b2'), card('b3'), card('b4')] },
    { commander: card('Commander C'), cards: [card('c1'), card('c2'), card('c3'), card('c4')] },
    { commander: card('Commander D'), cards: [card('d1'), card('d2'), card('d3'), card('d4')] },
  ],
  order: Array.from({ length: 16 }, (_, i) => i),
  isActive: true,
  dateCreated: 0,
  dateLastUpdated: 0,
  ...overrides,
});

const createSubmission = (overrides?: Partial<SynergyConnectSubmission>): SynergyConnectSubmission => ({
  userId: 'user-1',
  date: DATE,
  solvedGroups: [],
  guesses: [],
  mistakes: 0,
  dateCreated: 0,
  dateLastUpdated: 0,
  ...overrides,
});

const groupAGuess = { date: DATE, cards: ['oracle-a1', 'oracle-a2', 'oracle-a3', 'oracle-a4'] };
const mixedGuess = { date: DATE, cards: ['oracle-a1', 'oracle-a2', 'oracle-a3', 'oracle-b1'] };

describe('Synergy Connect guess API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (synergyConnectPuzzleDao.getByDate as jest.Mock).mockResolvedValue(createPuzzle());
    (synergyConnectSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(undefined);
    (synergyConnectUserStatsDao.getByUserId as jest.Mock).mockResolvedValue(undefined);
    (synergyConnectSubmissionDao.createSubmission as jest.Mock).mockImplementation(async (doc) => ({
      ...doc,
      dateCreated: 0,
      dateLastUpdated: 0,
    }));
  });

  it('returns 404 when the puzzle does not exist', async () => {
    (synergyConnectPuzzleDao.getByDate as jest.Mock).mockResolvedValue(undefined);
    const res = await call(guessSynergyConnectHandler).withBody(groupAGuess).send();
    expect(res.status).toEqual(404);
  });

  it('rejects a selection that is not four distinct board cards', async () => {
    const res = await call(guessSynergyConnectHandler)
      .withBody({ date: DATE, cards: ['oracle-a1', 'oracle-a1', 'oracle-a2', 'oracle-a3'] })
      .send();
    expect(res.status).toEqual(400);
  });

  it('judges anonymous guesses without persisting anything', async () => {
    const res = await call(guessSynergyConnectHandler).withBody(groupAGuess).send();

    expect(res.status).toEqual(200);
    expect(res.body.correct).toBe(true);
    expect(res.body.group.commander.name).toEqual('Commander A');
    expect(res.body.stats).toBeNull();
    expect(synergyConnectSubmissionDao.createSubmission).not.toHaveBeenCalled();
    expect(synergyConnectUserStatsDao.createUserStats).not.toHaveBeenCalled();
  });

  it('records a solved group and starts a streak on first play', async () => {
    const user = createUser({ id: 'user-1' });
    const res = await call(guessSynergyConnectHandler).as(user).withBody(groupAGuess).send();

    expect(res.status).toEqual(200);
    expect(res.body.correct).toBe(true);
    expect(synergyConnectSubmissionDao.createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ solvedGroups: [0], mistakes: 0, guesses: [[0, 0, 0, 0]] }),
    );
    expect(synergyConnectUserStatsDao.createUserStats).toHaveBeenCalledWith(
      expect.objectContaining({ currentStreak: 1, longestStreak: 1, totalPlayed: 1, totalSolved: 1 }),
    );
  });

  it('counts a wrong guess as a mistake and reports one away', async () => {
    const user = createUser({ id: 'user-1' });
    const res = await call(guessSynergyConnectHandler).as(user).withBody(mixedGuess).send();

    expect(res.status).toEqual(200);
    expect(res.body.correct).toBe(false);
    expect(res.body.oneAway).toBe(true);
    expect(synergyConnectSubmissionDao.createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ solvedGroups: [], mistakes: 1 }),
    );
  });

  it('reveals every group when the last life is spent', async () => {
    const user = createUser({ id: 'user-1' });
    (synergyConnectSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(
      createSubmission({ mistakes: 3, guesses: [[0, 1, 2, 3]] }),
    );

    const res = await call(guessSynergyConnectHandler).as(user).withBody(mixedGuess).send();

    expect(res.status).toEqual(200);
    expect(res.body.submission.mistakes).toEqual(4);
    expect(res.body.revealed).toHaveLength(4);
    expect(res.body.revealed[0].commander.name).toEqual('Commander A');
  });

  it('does not reveal anything while lives remain', async () => {
    const user = createUser({ id: 'user-1' });
    (synergyConnectSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(createSubmission({ mistakes: 1 }));

    const res = await call(guessSynergyConnectHandler).as(user).withBody(mixedGuess).send();

    expect(res.body.revealed).toBeNull();
    expect(res.body.group).toBeNull();
  });

  it('marks a perfect day when the fourth group is solved with no mistakes', async () => {
    const user = createUser({ id: 'user-1' });
    (synergyConnectSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(
      createSubmission({ solvedGroups: [1, 2, 3], mistakes: 0 }),
    );

    const res = await call(guessSynergyConnectHandler).as(user).withBody(groupAGuess).send();

    expect(res.body.submission.completedAt).toBeTruthy();
    expect(synergyConnectUserStatsDao.createUserStats).toHaveBeenCalledWith(
      expect.objectContaining({ perfectDays: 1 }),
    );
  });

  it('refuses further guesses once the game is over', async () => {
    const user = createUser({ id: 'user-1' });
    (synergyConnectSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(createSubmission({ mistakes: 4 }));

    const res = await call(guessSynergyConnectHandler).as(user).withBody(groupAGuess).send();
    expect(res.status).toEqual(409);
  });

  it('does not double-count an already solved group', async () => {
    const user = createUser({ id: 'user-1' });
    (synergyConnectSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(
      createSubmission({ solvedGroups: [0] }),
    );

    const res = await call(guessSynergyConnectHandler).as(user).withBody(groupAGuess).send();

    expect(res.status).toEqual(200);
    expect(res.body.correct).toBe(true);
    expect(synergyConnectSubmissionDao.update).not.toHaveBeenCalled();
  });

  it('does not advance the streak for archive puzzles', async () => {
    const user = createUser({ id: 'user-1' });
    (synergyConnectPuzzleDao.getByDate as jest.Mock).mockResolvedValue(createPuzzle({ isActive: false }));
    (synergyConnectUserStatsDao.getByUserId as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      currentStreak: 3,
      longestStreak: 5,
      lastPlayedDate: '2026-09-25',
      totalPlayed: 10,
      totalSolved: 30,
      perfectDays: 2,
      dateCreated: 0,
      dateLastUpdated: 0,
    });

    await call(guessSynergyConnectHandler).as(user).withBody(groupAGuess).send();

    expect(synergyConnectUserStatsDao.update).toHaveBeenCalledWith(
      expect.objectContaining({ currentStreak: 3, lastPlayedDate: '2026-09-25', totalPlayed: 11 }),
    );
  });
});
