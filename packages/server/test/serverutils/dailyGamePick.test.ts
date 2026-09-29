import { DailyGameKey } from '@utils/datatypes/DailyGameStats';
import { CrosswordPuzzle } from '@utils/datatypes/Crossword';
import { ManaMatrixPuzzle } from '@utils/datatypes/ManaMatrix';
import { SynergyConnectPuzzle } from '@utils/datatypes/SynergyConnect';

jest.mock('../../src/dynamo/daos', () => ({
  ...jest.requireActual('../../src/dynamo/daos'),
  dailyP1P1Dao: { getCurrentDailyP1P1: jest.fn() },
  p1p1PackDao: { getMetadataById: jest.fn(), getById: jest.fn() },
  cubeDao: { getById: jest.fn() },
  manaMatrixPuzzleDao: { getActive: jest.fn() },
  manaMatrixSubmissionDao: { getByUserAndDate: jest.fn() },
  synergyConnectPuzzleDao: { getActive: jest.fn() },
  synergyConnectSubmissionDao: { getByUserAndDate: jest.fn() },
  crosswordPuzzleDao: { getActive: jest.fn() },
  crosswordSubmissionDao: { getByUserAndDate: jest.fn() },
}));

import {
  crosswordPuzzleDao,
  crosswordSubmissionDao,
  cubeDao,
  dailyP1P1Dao,
  manaMatrixPuzzleDao,
  manaMatrixSubmissionDao,
  p1p1PackDao,
  synergyConnectPuzzleDao,
  synergyConnectSubmissionDao,
} from '../../src/dynamo/daos';
import { pickDailyGame, toCrosswordTeaser } from '../../src/serverutils/dailyGamePick';

const DATE = '2026-09-29';
const USER = 'user-1';

const manaMatrixPuzzle = (): ManaMatrixPuzzle => ({
  id: DATE,
  type: 'HISTORY',
  date: DATE,
  columns: [
    { filterText: 'ci=g', description: 'green' },
    { filterText: 'mv=1', description: 'mana value 1' },
    { filterText: 't:elf', description: 'an Elf' },
  ],
  rows: [
    { filterText: 'ci=u', description: 'blue' },
    { filterText: 'mv=2', description: 'mana value 2' },
    { filterText: 't:goblin', description: 'a Goblin' },
  ],
  counts: [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ],
  isActive: true,
  dateCreated: 0,
  dateLastUpdated: 0,
});

const synergyConnectPuzzle = (): SynergyConnectPuzzle => ({
  id: DATE,
  type: 'HISTORY',
  date: DATE,
  theme: { filterText: 'ci=wu', description: 'in Azorius colors' },
  groups: [0, 1, 2, 3].map((group) => ({
    commander: { name: `Commander ${group}`, oracleId: `commander-${group}` },
    cards: [0, 1, 2, 3].map((card) => ({ name: `Card ${group}-${card}`, oracleId: `oracle-${group}-${card}` })),
  })),
  order: Array.from({ length: 16 }, (_, index) => index),
  isActive: true,
  dateCreated: 0,
  dateLastUpdated: 0,
});

/**
 * A 3x3 with one black square, filled with CAT / ARE / TEN. The letters and the entry
 * texts are what must never reach the dashboard.
 */
const crosswordPuzzle = (): CrosswordPuzzle => ({
  id: DATE,
  type: 'HISTORY',
  date: DATE,
  grid: {
    width: 3,
    height: 3,
    blockCount: 1,
    blocks: [
      [false, false, false],
      [false, false, false],
      [false, false, true],
    ],
    letters: [
      ['C', 'A', 'T'],
      ['A', 'R', 'E'],
      ['T', 'E', ''],
    ],
    slots: [
      {
        id: 'a-0-0',
        direction: 'across',
        row: 0,
        col: 0,
        length: 3,
        number: 1,
        entry: { text: 'CAT', display: 'Felidae', entryClass: 'nameWord' },
        clue: 'Purring pet',
      },
      {
        id: 'a-1-0',
        direction: 'across',
        row: 1,
        col: 0,
        length: 3,
        number: 4,
        entry: { text: 'ARE', display: 'Plural of is', entryClass: 'oracleWord' },
        clue: 'They ___ here',
      },
    ],
  },
  isActive: true,
  dateCreated: 0,
  dateLastUpdated: 0,
});

const dailyP1P1Record = () => ({
  id: 'daily-1',
  type: 'HISTORY',
  packId: 'pack-1',
  cubeId: 'cube-1',
  date: 1_800_000_000_000,
  isActive: true,
  dateCreated: 0,
  dateLastUpdated: 0,
});

/** Nobody has played anything, and every game has a live puzzle. */
const everythingUntouched = () => {
  (dailyP1P1Dao.getCurrentDailyP1P1 as jest.Mock).mockResolvedValue(dailyP1P1Record());
  (p1p1PackDao.getMetadataById as jest.Mock).mockResolvedValue({ id: 'pack-1', votesByUser: {} });
  (p1p1PackDao.getById as jest.Mock).mockResolvedValue({ id: 'pack-1', cards: [], votesByUser: {} });
  (cubeDao.getById as jest.Mock).mockResolvedValue({ id: 'cube-1', name: 'A Cube' });
  (manaMatrixPuzzleDao.getActive as jest.Mock).mockResolvedValue(manaMatrixPuzzle());
  (manaMatrixSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(undefined);
  (synergyConnectPuzzleDao.getActive as jest.Mock).mockResolvedValue(synergyConnectPuzzle());
  (synergyConnectSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(undefined);
  (crosswordPuzzleDao.getActive as jest.Mock).mockResolvedValue(crosswordPuzzle());
  (crosswordSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(undefined);
};

/** Marks a game as started by this user, the way that game records it. */
const markTouched = (game: DailyGameKey) => {
  switch (game) {
    case 'dailyp1p1':
      (p1p1PackDao.getMetadataById as jest.Mock).mockResolvedValue({
        id: 'pack-1',
        votesByUser: { [USER]: 3 },
      });
      return;
    case 'manamatrix':
      (manaMatrixSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue({ userId: USER, date: DATE });
      return;
    case 'synergyconnect':
      (synergyConnectSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue({ userId: USER, date: DATE });
      return;
    case 'crossword':
      // The crossword's row is written when the puzzle is opened, so this is the
      // emptiest row that game can produce: no attempts, no checks, no reveals.
      (crosswordSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue({
        userId: USER,
        date: DATE,
        startedAt: 1,
        attempts: 0,
        checks: 0,
        reveals: 0,
        solved: false,
      });
      return;
  }
};

const pickFor = async (userId: string | undefined = USER, today: string = DATE) => pickDailyGame({ userId, today });

const pickedGame = async (userId?: string, today?: string): Promise<DailyGameKey | undefined> =>
  (await pickFor(userId, today)).teaser?.game;

/**
 * Every game the slot would offer this user today, in the order it offers them, by
 * playing each one as it comes up. `alreadyTouched` seeds games as started first.
 */
const playThrough = async (
  alreadyTouched: DailyGameKey[] = [],
  userId: string = USER,
  today: string = DATE,
): Promise<DailyGameKey[]> => {
  everythingUntouched();
  alreadyTouched.forEach(markTouched);

  const order: DailyGameKey[] = [];
  for (let step = 0; step < 4; step++) {
    const game = await pickedGame(userId, today);
    if (!game) {
      break;
    }
    order.push(game);
    markTouched(game);
  }
  return order;
};

describe('pickDailyGame', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    everythingUntouched();
  });

  describe('the untouched filter, per game', () => {
    it.each<DailyGameKey>(['dailyp1p1', 'manamatrix', 'synergyconnect', 'crossword'])(
      'never offers %s once the user has started it',
      async (game) => {
        // Played all the way through, so the assertion is over every position in the
        // rotation rather than just whichever one happens to come up first.
        const offered = await playThrough([game]);

        expect(offered).not.toContain(game);
        expect(offered).toHaveLength(3);
      },
    );

    it('still offers Daily P1P1 when the day has votes from other users', async () => {
      (p1p1PackDao.getMetadataById as jest.Mock).mockResolvedValue({
        id: 'pack-1',
        votesByUser: { 'someone-else': 0, 'another-user': 2 },
      });
      markTouched('manamatrix');
      markTouched('synergyconnect');
      markTouched('crossword');

      expect(await pickedGame()).toEqual('dailyp1p1');
    });

    it('treats a vote of card index 0 as a vote', async () => {
      // A falsy but present value. `votesByUser[userId]` is a card index, so 0 is the
      // first card in the pack, not "no vote".
      (p1p1PackDao.getMetadataById as jest.Mock).mockResolvedValue({ id: 'pack-1', votesByUser: { [USER]: 0 } });
      markTouched('manamatrix');
      markTouched('synergyconnect');
      markTouched('crossword');

      expect(await pickFor()).toEqual({ teaser: null, allPlayed: true });
    });

    it('offers a game whose puzzle is live even when another game has none', async () => {
      (manaMatrixPuzzleDao.getActive as jest.Mock).mockResolvedValue(undefined);

      for (let attempt = 0; attempt < 8; attempt++) {
        expect(await pickedGame(`user-${attempt}`)).not.toEqual('manamatrix');
      }
      expect(manaMatrixSubmissionDao.getByUserAndDate).not.toHaveBeenCalled();
    });
  });

  describe('when everything has been played', () => {
    it('reports the all-played state rather than a teaser', async () => {
      markTouched('dailyp1p1');
      markTouched('manamatrix');
      markTouched('synergyconnect');
      markTouched('crossword');

      expect(await pickFor()).toEqual({ teaser: null, allPlayed: true });
    });

    it('is all-played once the only live games have been played', async () => {
      // Two games have no puzzle today. A game that cannot be played must not keep the
      // slot from acknowledging that the player is done.
      (manaMatrixPuzzleDao.getActive as jest.Mock).mockResolvedValue(undefined);
      (synergyConnectPuzzleDao.getActive as jest.Mock).mockResolvedValue(undefined);
      markTouched('dailyp1p1');
      markTouched('crossword');

      expect(await pickFor()).toEqual({ teaser: null, allPlayed: true });
    });

    it('does not congratulate anyone on a day with no puzzles at all', async () => {
      (dailyP1P1Dao.getCurrentDailyP1P1 as jest.Mock).mockResolvedValue(undefined);
      (manaMatrixPuzzleDao.getActive as jest.Mock).mockResolvedValue(undefined);
      (synergyConnectPuzzleDao.getActive as jest.Mock).mockResolvedValue(undefined);
      (crosswordPuzzleDao.getActive as jest.Mock).mockResolvedValue(undefined);

      expect(await pickFor()).toEqual({ teaser: null, allPlayed: false });
    });

    it('falls through to the next game when the pick cannot be rendered', async () => {
      // An expired P1P1 pack: the daily record points at it, but its S3 payload is gone.
      (p1p1PackDao.getById as jest.Mock).mockResolvedValue(undefined);
      markTouched('manamatrix');
      markTouched('synergyconnect');

      const result = await pickFor();
      expect(result.teaser?.game).toEqual('crossword');
      expect(result.allPlayed).toBe(false);
    });
  });

  describe('anonymous viewers', () => {
    it('reads every game as untouched without asking for any per-user row', async () => {
      const result = await pickDailyGame({ today: DATE });

      expect(result.teaser).not.toBeNull();
      expect(result.allPlayed).toBe(false);
      expect(manaMatrixSubmissionDao.getByUserAndDate).not.toHaveBeenCalled();
      expect(synergyConnectSubmissionDao.getByUserAndDate).not.toHaveBeenCalled();
      expect(crosswordSubmissionDao.getByUserAndDate).not.toHaveBeenCalled();
      expect(p1p1PackDao.getMetadataById).not.toHaveBeenCalled();
    });

    it('does not blow up when a stored vote map happens to have an empty-string key', async () => {
      // Guards the `votesByUser[userId]` lookup against a missing user id being coerced
      // into a key that exists.
      (p1p1PackDao.getMetadataById as jest.Mock).mockResolvedValue({ id: 'pack-1', votesByUser: { '': 1 } });
      markTouched('manamatrix');
      markTouched('synergyconnect');
      markTouched('crossword');

      expect((await pickDailyGame({ today: DATE })).teaser?.game).toEqual('dailyp1p1');
    });
  });

  describe('the pick is deterministic per (user, date)', () => {
    it('gives the same user the same game all day', async () => {
      const picks = await Promise.all([pickedGame(), pickedGame(), pickedGame()]);

      expect(new Set(picks).size).toBe(1);
      expect(picks[0]).toBeDefined();
    });

    it('does not reshuffle when a game other than the pick is played', async () => {
      const rotation = await playThrough();
      expect(rotation).toHaveLength(4);

      // Playing the game at the bottom of the rotation must not move the one on top,
      // and the rest of the order has to survive intact.
      expect(await playThrough([rotation[3]!])).toEqual(rotation.slice(0, 3));

      // Playing the top one promotes exactly the next one down.
      expect(await playThrough([rotation[0]!])).toEqual(rotation.slice(1));
    });

    it('gives different users different games', async () => {
      const picks = await Promise.all(Array.from({ length: 12 }, (_, index) => pickedGame(`user-${index}`, DATE)));

      expect(new Set(picks).size).toBeGreaterThan(1);
    });

    it('rotates from one day to the next', async () => {
      const picks = await Promise.all(
        ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].map((day) =>
          pickedGame(USER, day),
        ),
      );

      expect(new Set(picks).size).toBeGreaterThan(1);
    });
  });

  describe('read cost', () => {
    it('only pays for the P1P1 pack body when P1P1 is the game shown', async () => {
      const rotation = await playThrough();
      const beforeP1P1 = rotation.slice(0, rotation.indexOf('dailyp1p1'));

      jest.clearAllMocks();
      everythingUntouched();
      await pickFor();

      // The touch check reads the pack's DynamoDB row (votesByUser) but never its S3
      // payload or its cube, unless P1P1 is what gets rendered.
      expect(p1p1PackDao.getMetadataById).toHaveBeenCalledTimes(1);
      if (beforeP1P1.length > 0) {
        expect(p1p1PackDao.getById).not.toHaveBeenCalled();
        expect(cubeDao.getById).not.toHaveBeenCalled();
      } else {
        expect(p1p1PackDao.getById).toHaveBeenCalledTimes(1);
      }
    });

    it('asks each game exactly once', async () => {
      await pickFor();

      expect(manaMatrixPuzzleDao.getActive).toHaveBeenCalledTimes(1);
      expect(synergyConnectPuzzleDao.getActive).toHaveBeenCalledTimes(1);
      expect(crosswordPuzzleDao.getActive).toHaveBeenCalledTimes(1);
      expect(dailyP1P1Dao.getCurrentDailyP1P1).toHaveBeenCalledTimes(1);
    });

    it('looks each submission up by the puzzle date, which is a primary-key get', async () => {
      await pickFor();

      expect(manaMatrixSubmissionDao.getByUserAndDate).toHaveBeenCalledWith(USER, DATE);
      expect(synergyConnectSubmissionDao.getByUserAndDate).toHaveBeenCalledWith(USER, DATE);
      expect(crosswordSubmissionDao.getByUserAndDate).toHaveBeenCalledWith(USER, DATE);
    });
  });

  describe('opting out of featured cube content', () => {
    it('never shows Daily P1P1 and never reads it', async () => {
      for (let attempt = 0; attempt < 12; attempt++) {
        const result = await pickDailyGame({ userId: `user-${attempt}`, today: DATE, includeDailyP1P1: false });
        expect(result.teaser?.game).not.toEqual('dailyp1p1');
      }

      expect(dailyP1P1Dao.getCurrentDailyP1P1).not.toHaveBeenCalled();
      expect(p1p1PackDao.getMetadataById).not.toHaveBeenCalled();
    });

    it('is all-played once the other three are done', async () => {
      markTouched('manamatrix');
      markTouched('synergyconnect');
      markTouched('crossword');

      expect(await pickDailyGame({ userId: USER, today: DATE, includeDailyP1P1: false })).toEqual({
        teaser: null,
        allPlayed: true,
      });
    });
  });

  it('degrades to an empty slot and logs when a read fails', async () => {
    const logger = { error: jest.fn() };
    (manaMatrixPuzzleDao.getActive as jest.Mock).mockRejectedValue(new Error('dynamo is down'));

    expect(await pickDailyGame({ logger, userId: USER, today: DATE })).toEqual({ teaser: null, allPlayed: false });
    expect(logger.error).toHaveBeenCalledWith('Error picking the daily game:', expect.any(Error));
  });

  describe('what each teaser carries', () => {
    it('hands the crossword card a shape and nothing that is an answer', async () => {
      markTouched('dailyp1p1');
      markTouched('manamatrix');
      markTouched('synergyconnect');

      const { teaser } = await pickFor();
      expect(teaser?.game).toEqual('crossword');

      const serialized = JSON.stringify(teaser);
      expect(serialized).not.toContain('CAT');
      expect(serialized).not.toContain('ARE');
      expect(serialized).not.toContain('Felidae');
      expect(serialized).not.toContain('Plural of is');
      expect(serialized).not.toContain('Purring pet');
      expect(teaser).toEqual({
        game: 'crossword',
        shape: {
          date: DATE,
          width: 3,
          height: 3,
          blocks: [
            [false, false, false],
            [false, false, false],
            [false, false, true],
          ],
          clueCount: 2,
        },
      });
    });

    it('hands the Synergy Connect card no group membership and no commanders', async () => {
      markTouched('dailyp1p1');
      markTouched('manamatrix');
      markTouched('crossword');

      const { teaser } = await pickFor();
      expect(teaser?.game).toEqual('synergyconnect');

      const serialized = JSON.stringify(teaser);
      expect(serialized).not.toContain('Commander');
      expect(serialized).not.toContain('commander-');
      expect(teaser).toMatchObject({
        game: 'synergyconnect',
        board: { date: DATE, solvedGroups: [] },
      });
      expect((teaser as any).board.cards).toHaveLength(16);
    });

    it('hands the Mana Matrix card the day’s puzzle', async () => {
      markTouched('dailyp1p1');
      markTouched('synergyconnect');
      markTouched('crossword');

      expect(await pickFor()).toEqual({
        teaser: { game: 'manamatrix', puzzle: manaMatrixPuzzle() },
        allPlayed: false,
      });
    });

    it('hands the Daily P1P1 card its pack and cube', async () => {
      markTouched('manamatrix');
      markTouched('synergyconnect');
      markTouched('crossword');

      expect(await pickFor()).toEqual({
        teaser: {
          game: 'dailyp1p1',
          pack: { id: 'pack-1', cards: [], votesByUser: {} },
          cube: { id: 'cube-1', name: 'A Cube' },
          date: 1_800_000_000_000,
        },
        allPlayed: false,
      });
    });
  });
});

describe('toCrosswordTeaser', () => {
  it('copies the block rows rather than aliasing the stored grid', () => {
    const puzzle = crosswordPuzzle();
    const teaser = toCrosswordTeaser(puzzle);

    teaser.blocks[0]![0] = true;

    expect(puzzle.grid.blocks[0]![0]).toBe(false);
  });

  it('carries no letters and no entry texts', () => {
    const teaser = toCrosswordTeaser(crosswordPuzzle());

    expect(teaser).not.toHaveProperty('letters');
    expect(teaser).not.toHaveProperty('slots');
    expect(JSON.stringify(teaser)).not.toMatch(/CAT|ARE|Felidae/);
  });
});
