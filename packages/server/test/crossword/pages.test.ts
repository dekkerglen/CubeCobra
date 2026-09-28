import { CrosswordPuzzle, CrosswordSubmission } from '@utils/datatypes/Crossword';

jest.mock('../../src/dynamo/daos', () => ({
  ...jest.requireActual('../../src/dynamo/daos'),
  crosswordPuzzleDao: { getByDate: jest.fn(), getActive: jest.fn(), getHistory: jest.fn() },
  crosswordSubmissionDao: { getByUserAndDate: jest.fn(), createSubmission: jest.fn(), update: jest.fn() },
  crosswordUserStatsDao: { getByUserId: jest.fn(), createUserStats: jest.fn(), update: jest.fn() },
}));

jest.mock('serverutils/render', () => ({
  render: jest.fn(),
  redirect: jest.fn(),
}));

import { crosswordPuzzleDao, crosswordSubmissionDao, crosswordUserStatsDao } from '../../src/dynamo/daos';
import { getArchiveHandler } from '../../src/router/routes/tool/crossword/archive';
import { crosswordDatePageHandler, crosswordPageHandler } from '../../src/router/routes/tool/crossword';
import { redirect, render } from '../../src/serverutils/render';
import { createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

const DATE = '2026-09-28';
const NOW = 1_800_000_000_000;

const createPuzzle = (overrides?: Partial<CrosswordPuzzle>): CrosswordPuzzle => ({
  id: DATE,
  type: 'HISTORY',
  date: DATE,
  grid: {
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
  },
  isActive: true,
  dateCreated: 0,
  dateLastUpdated: 0,
  ...overrides,
});

const createSubmission = (overrides?: Partial<CrosswordSubmission>): CrosswordSubmission => ({
  userId: 'user-1',
  date: DATE,
  startedAt: NOW - 45_000,
  attempts: 0,
  checks: 0,
  reveals: 0,
  solved: false,
  dateCreated: 0,
  dateLastUpdated: 0,
  ...overrides,
});

const renderedProps = () => (render as jest.Mock).mock.calls[0]![3];

describe('crossword page handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    (crosswordPuzzleDao.getActive as jest.Mock).mockResolvedValue(createPuzzle());
    (crosswordPuzzleDao.getByDate as jest.Mock).mockResolvedValue(createPuzzle());
    (crosswordSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(createSubmission());
    (crosswordUserStatsDao.getByUserId as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // The page render is the main path into the game, so it is the main place a
  // solution could leak into the page source.
  it('renders a board with no letters and no entry texts', async () => {
    await call(crosswordPageHandler).send();

    expect(render).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'CrosswordPage', expect.anything());
    const props = renderedProps();
    const serialized = JSON.stringify(props);
    expect(serialized).not.toContain('CAT');
    expect(serialized).not.toContain('Felidae');
    expect(props.board).not.toHaveProperty('letters');
    expect(props.board.slots[0]).not.toHaveProperty('entry');
    expect(props.answers).toBeNull();
  });

  it('starts the clock for a logged-in viewer', async () => {
    (crosswordSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(undefined);
    (crosswordSubmissionDao.createSubmission as jest.Mock).mockImplementation(async (doc) => ({
      ...doc,
      dateCreated: NOW,
      dateLastUpdated: NOW,
    }));

    await call(crosswordPageHandler)
      .as(createUser({ id: 'user-1' }))
      .send();

    expect(crosswordSubmissionDao.createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', date: DATE, startedAt: NOW, solved: false }),
    );
    expect(renderedProps().elapsedMs).toEqual(0);
  });

  it('reports the server-measured elapsed time on a resumed run', async () => {
    await call(crosswordPageHandler)
      .as(createUser({ id: 'user-1' }))
      .send();

    expect(renderedProps().elapsedMs).toEqual(45_000);
  });

  it('never starts a clock for an anonymous viewer', async () => {
    await call(crosswordPageHandler).send();

    expect(crosswordSubmissionDao.createSubmission).not.toHaveBeenCalled();
    expect(renderedProps()).toMatchObject({ submission: null, elapsedMs: null, isArchive: false });
  });

  it('sends the answers once the viewer has solved it', async () => {
    (crosswordSubmissionDao.getByUserAndDate as jest.Mock).mockResolvedValue(
      createSubmission({ solved: true, completionTimeMs: 45_000 }),
    );

    await call(crosswordPageHandler)
      .as(createUser({ id: 'user-1' }))
      .send();

    expect(renderedProps().answers).toEqual([
      { id: 'a-0-0', number: 1, direction: 'across', text: 'CAT', display: 'Felidae', entryClass: 'nameWord' },
    ]);
  });

  it('marks a past puzzle as an archive puzzle', async () => {
    (crosswordPuzzleDao.getByDate as jest.Mock).mockResolvedValue(createPuzzle({ isActive: false }));

    await call(crosswordDatePageHandler).withParams({ date: DATE }).withFlash(jest.fn()).send();

    expect(renderedProps().isArchive).toBe(true);
  });

  it('redirects with a flash when the date has no puzzle', async () => {
    (crosswordPuzzleDao.getByDate as jest.Mock).mockResolvedValue(undefined);
    const flash = jest.fn();

    await call(crosswordDatePageHandler).withParams({ date: DATE }).withFlash(flash).send();

    expect(flash).toHaveBeenCalledWith('danger', 'No crossword exists for that date');
    expect(redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/tool/crossword');
    expect(render).not.toHaveBeenCalled();
  });

  it('lists the archive by date and size, with no grids in it', async () => {
    (crosswordPuzzleDao.getHistory as jest.Mock).mockResolvedValue({
      items: [createPuzzle(), createPuzzle({ id: '2026-09-27', date: '2026-09-27' })],
    });

    await call(getArchiveHandler).send();

    expect(render).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'CrosswordArchivePage',
      expect.objectContaining({
        history: [
          { date: DATE, size: 3, slots: 1 },
          { date: '2026-09-27', size: 3, slots: 1 },
        ],
        hasMore: false,
      }),
    );
    expect(JSON.stringify(renderedProps())).not.toContain('CAT');
  });
});
