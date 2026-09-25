import { ManaMatrixPuzzle } from '@utils/datatypes/ManaMatrix';

import { rotateManaMatrixHandler } from '../../../src/router/routes/tool/api/manamatrix/rotate';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  ...jest.requireActual('../../../src/dynamo/daos'),
  manaMatrixPuzzleDao: {
    getByDate: jest.fn(),
    setActivePuzzle: jest.fn(),
  },
  manaMatrixCellStatsDao: {
    createForPuzzle: jest.fn(),
  },
}));

jest.mock('serverutils/manamatrix/generate', () => ({
  generatePuzzle: jest.fn(),
}));

jest.mock('serverutils/cardCatalog', () => ({
  __esModule: true,
  default: {},
  whenCardDbReady: jest.fn().mockResolvedValue(undefined),
}));

import { manaMatrixCellStatsDao, manaMatrixPuzzleDao } from '../../../src/dynamo/daos';
import { generatePuzzle } from '../../../src/serverutils/manamatrix/generate';

const category = (filterText: string) => ({ filterText, description: filterText });

const createPuzzle = (overrides?: Partial<ManaMatrixPuzzle>): ManaMatrixPuzzle => ({
  id: '2026-09-24',
  type: 'HISTORY',
  date: '2026-09-24',
  columns: [category('cmc=1'), category('cmc=2'), category('cmc=3')],
  rows: [category('type:creature'), category('type:instant'), category('type:sorcery')],
  counts: [
    [10, 10, 10],
    [10, 10, 10],
    [10, 10, 10],
  ],
  isActive: true,
  dateCreated: 0,
  dateLastUpdated: 0,
  ...overrides,
});

describe('Rotate ManaMatrix API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MANAMATRIX_API_KEY = 'test-key';
  });

  afterAll(() => {
    delete process.env.MANAMATRIX_API_KEY;
  });

  it('returns 401 for a wrong api key', async () => {
    const res = await call(rotateManaMatrixHandler).withBody({ apiKey: 'wrong-key' }).send();

    expect(res.status).toEqual(401);
    expect(manaMatrixPuzzleDao.getByDate).not.toHaveBeenCalled();
  });

  it('returns 401 when the api key is not configured, even for an empty key', async () => {
    delete process.env.MANAMATRIX_API_KEY;

    const res = await call(rotateManaMatrixHandler).withBody({ apiKey: '' }).send();

    expect(res.status).toEqual(401);
  });

  it('is idempotent: returns the existing puzzle without regenerating', async () => {
    const existing = createPuzzle();
    (manaMatrixPuzzleDao.getByDate as jest.Mock).mockResolvedValue(existing);

    const res = await call(rotateManaMatrixHandler).withBody({ apiKey: 'test-key', date: '2026-09-24' }).send();

    expect(res.status).toEqual(200);
    expect(res.body).toEqual({ success: true, puzzle: existing, alreadyExisted: true });
    expect(generatePuzzle).not.toHaveBeenCalled();
    expect(manaMatrixPuzzleDao.setActivePuzzle).not.toHaveBeenCalled();
    expect(manaMatrixCellStatsDao.createForPuzzle).not.toHaveBeenCalled();
  });

  it('generates, activates, and creates cell stats for a new date', async () => {
    const puzzle = createPuzzle();
    (manaMatrixPuzzleDao.getByDate as jest.Mock).mockResolvedValue(undefined);
    (generatePuzzle as jest.Mock).mockReturnValue({
      columns: puzzle.columns,
      rows: puzzle.rows,
      counts: puzzle.counts,
    });
    (manaMatrixPuzzleDao.setActivePuzzle as jest.Mock).mockResolvedValue(puzzle);

    const res = await call(rotateManaMatrixHandler).withBody({ apiKey: 'test-key', date: '2026-09-24' }).send();

    expect(res.status).toEqual(200);
    expect(res.body).toEqual({ success: true, puzzle });
    expect(generatePuzzle).toHaveBeenCalledWith('2026-09-24');
    expect(manaMatrixPuzzleDao.setActivePuzzle).toHaveBeenCalledWith({
      date: '2026-09-24',
      columns: puzzle.columns,
      rows: puzzle.rows,
      counts: puzzle.counts,
      isActive: true,
    });
    expect(manaMatrixCellStatsDao.createForPuzzle).toHaveBeenCalledWith('2026-09-24');
  });

  it('defaults the date to the current puzzle day when omitted', async () => {
    (manaMatrixPuzzleDao.getByDate as jest.Mock).mockResolvedValue(undefined);
    (generatePuzzle as jest.Mock).mockReturnValue({ columns: [], rows: [], counts: [] });
    (manaMatrixPuzzleDao.setActivePuzzle as jest.Mock).mockResolvedValue(createPuzzle());

    const res = await call(rotateManaMatrixHandler).withBody({ apiKey: 'test-key' }).send();

    expect(res.status).toEqual(200);
    expect(generatePuzzle).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it('returns 500 when generation fails', async () => {
    (manaMatrixPuzzleDao.getByDate as jest.Mock).mockResolvedValue(undefined);
    (generatePuzzle as jest.Mock).mockImplementation(() => {
      throw new Error('no viable puzzle');
    });

    const res = await call(rotateManaMatrixHandler).withBody({ apiKey: 'test-key', date: '2026-09-24' }).send();

    expect(res.status).toEqual(500);
  });
});
