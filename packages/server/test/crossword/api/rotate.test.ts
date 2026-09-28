import { CrosswordPuzzle } from '@utils/datatypes/Crossword';

import { rotateCrosswordHandler } from '../../../src/router/routes/tool/api/crossword/rotate';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  ...jest.requireActual('../../../src/dynamo/daos'),
  crosswordPuzzleDao: {
    getByDate: jest.fn(),
    setActivePuzzle: jest.fn(),
  },
}));

jest.mock('serverutils/crossword/puzzle', () => ({
  buildDailyGrid: jest.fn(),
  isBuildFailure: (result: any) => result?.reason !== undefined,
}));

jest.mock('serverutils/cardCatalog', () => ({
  __esModule: true,
  default: {},
  whenCardDbReady: jest.fn().mockResolvedValue(undefined),
}));

import { crosswordPuzzleDao } from '../../../src/dynamo/daos';
import { buildDailyGrid } from '../../../src/serverutils/crossword/puzzle';

const DATE = '2026-09-28';

const createGrid = (): CrosswordPuzzle['grid'] => ({
  width: 3,
  height: 3,
  blockCount: 0,
  blocks: [
    [false, false, false],
    [false, false, false],
    [false, false, false],
  ],
  letters: [
    ['C', 'A', 'T'],
    ['A', 'R', 'E'],
    ['T', 'E', 'N'],
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
  ],
});

const createPuzzle = (overrides?: Partial<CrosswordPuzzle>): CrosswordPuzzle => ({
  id: DATE,
  type: 'HISTORY',
  date: DATE,
  grid: createGrid(),
  isActive: true,
  dateCreated: 0,
  dateLastUpdated: 0,
  ...overrides,
});

describe('Rotate crossword API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Shared with the other daily rotations on purpose: one key, no new secret.
    process.env.MANAMATRIX_API_KEY = 'test-key';
  });

  afterAll(() => {
    delete process.env.MANAMATRIX_API_KEY;
  });

  it('returns 401 for a wrong api key', async () => {
    const res = await call(rotateCrosswordHandler).withBody({ apiKey: 'wrong-key' }).send();

    expect(res.status).toEqual(401);
    expect(crosswordPuzzleDao.getByDate).not.toHaveBeenCalled();
  });

  it('returns 401 when the api key is not configured, even for an empty key', async () => {
    delete process.env.MANAMATRIX_API_KEY;

    const res = await call(rotateCrosswordHandler).withBody({ apiKey: '' }).send();

    expect(res.status).toEqual(401);
    expect(crosswordPuzzleDao.getByDate).not.toHaveBeenCalled();
  });

  it('is idempotent: returns the existing puzzle without regenerating', async () => {
    (crosswordPuzzleDao.getByDate as jest.Mock).mockResolvedValue(createPuzzle());

    const res = await call(rotateCrosswordHandler).withBody({ apiKey: 'test-key', date: DATE }).send();

    expect(res.status).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.alreadyExisted).toBe(true);
    expect(buildDailyGrid).not.toHaveBeenCalled();
    expect(crosswordPuzzleDao.setActivePuzzle).not.toHaveBeenCalled();
  });

  it('generates and activates a puzzle for a new date', async () => {
    const grid = createGrid();
    (crosswordPuzzleDao.getByDate as jest.Mock).mockResolvedValue(undefined);
    (buildDailyGrid as jest.Mock).mockReturnValue(grid);
    (crosswordPuzzleDao.setActivePuzzle as jest.Mock).mockResolvedValue(createPuzzle());

    const res = await call(rotateCrosswordHandler).withBody({ apiKey: 'test-key', date: DATE }).send();

    expect(res.status).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(buildDailyGrid).toHaveBeenCalledWith(DATE);
    expect(crosswordPuzzleDao.setActivePuzzle).toHaveBeenCalledWith({ date: DATE, grid, isActive: true });
  });

  // A crossword puzzle *is* its answer key, so unlike the other games the
  // response is a summary rather than the stored item.
  it('never puts the solution in the response', async () => {
    (crosswordPuzzleDao.getByDate as jest.Mock).mockResolvedValue(undefined);
    (buildDailyGrid as jest.Mock).mockReturnValue(createGrid());
    (crosswordPuzzleDao.setActivePuzzle as jest.Mock).mockResolvedValue(createPuzzle());

    const res = await call(rotateCrosswordHandler).withBody({ apiKey: 'test-key', date: DATE }).send();

    expect(res.body.puzzle).toEqual({ date: DATE, isActive: true, width: 3, height: 3, slots: 1 });
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('CAT');
    expect(serialized).not.toContain('letters');
  });

  it('defaults the date to the current puzzle day when omitted', async () => {
    (crosswordPuzzleDao.getByDate as jest.Mock).mockResolvedValue(undefined);
    (buildDailyGrid as jest.Mock).mockReturnValue(createGrid());
    (crosswordPuzzleDao.setActivePuzzle as jest.Mock).mockResolvedValue(createPuzzle());

    const res = await call(rotateCrosswordHandler).withBody({ apiKey: 'test-key' }).send();

    expect(res.status).toEqual(200);
    expect(buildDailyGrid).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it('returns 500 when no grid could be generated', async () => {
    (crosswordPuzzleDao.getByDate as jest.Mock).mockResolvedValue(undefined);
    (buildDailyGrid as jest.Mock).mockReturnValue({ reason: 'ran out of budget' });

    const res = await call(rotateCrosswordHandler).withBody({ apiKey: 'test-key', date: DATE }).send();

    expect(res.status).toEqual(500);
    expect(res.body.error).toContain('ran out of budget');
    expect(crosswordPuzzleDao.setActivePuzzle).not.toHaveBeenCalled();
  });

  it('returns 500 when generation throws', async () => {
    (crosswordPuzzleDao.getByDate as jest.Mock).mockResolvedValue(undefined);
    (buildDailyGrid as jest.Mock).mockImplementation(() => {
      throw new Error('vocabulary missing');
    });

    const res = await call(rotateCrosswordHandler).withBody({ apiKey: 'test-key', date: DATE }).send();

    expect(res.status).toEqual(500);
  });
});
