import { transcribeNewRecordHandler } from '../../../src/router/routes/cube/records/enter';
import { createCube } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: { getById: jest.fn() },
  draftDao: { getById: jest.fn(), update: jest.fn(), createDraft: jest.fn() },
  recordDao: { getById: jest.fn(), update: jest.fn(), createRecord: jest.fn() },
  userDao: { batchGet: jest.fn() },
}));

import { cubeDao, recordDao } from '../../../src/dynamo/daos';

/**
 * "Input Finished Event" opens the transcription workspace directly. The workspace already
 * asks for a record's name, date and description in its Event details card, so the wizard
 * that used to stand in front of it collected nothing new — it existed only to produce an id
 * before this page could load, and the POST behind it created a record the moment the button
 * was pressed. The first Save creates the record now, so opening the page and leaving creates
 * nothing at all.
 */
describe('transcribeNewRecordHandler', () => {
  const cube = createCube({ id: 'my-cube' });

  const overview = { name: 'Tuesday Night', date: Date.UTC(2026, 10, 4), description: '' };

  const body = (overrides: Record<string, unknown> = {}) => ({
    sections: { overview, ...((overrides.sections as object) ?? {}) },
    baselines: {},
    ...overrides,
  });

  // The delegated save re-reads the record it was told to save, so the store has to hand back
  // what was just created rather than a fixture — the point of creating from the baseline is
  // that the save then finds exactly what the client expected to be there.
  let stored: any;

  beforeEach(() => {
    jest.clearAllMocks();
    stored = undefined;
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (recordDao.createRecord as jest.Mock).mockImplementation(async (document: any) => {
      stored = { ...document, id: 'new-record-id' };
      return 'new-record-id';
    });
    (recordDao.getById as jest.Mock).mockImplementation(async () => (stored ? { ...stored } : undefined));
  });

  const save = (payload: unknown, user: any = cube.owner) =>
    call(transcribeNewRecordHandler).as(user).withParams({ id: cube.id }).withBody(payload).send();

  it('creates the record and reports the id it was given', async () => {
    const res = await save({ sections: { overview }, baselines: { overview } });

    expect(recordDao.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({ cube: cube.id, name: 'Tuesday Night', date: overview.date }),
    );
    expect(res.status).toEqual(200);
    expect(res.body.recordId).toEqual('new-record-id');
    expect(res.body.success).toEqual('true');
  });

  // The whole point of this path: a rejected save must not leave an empty record behind,
  // which is exactly what the button it replaced did.
  it('creates nothing when the submission is rejected', async () => {
    const res = await save({ sections: { overview: { name: '', date: 1, description: '' } }, baselines: {} });

    expect(res.status).toEqual(400);
    expect(recordDao.createRecord).not.toHaveBeenCalled();
  });

  // The page renders prefilled, so an organiser who changes nothing submits no overview at
  // all. The record still has to be created, under the name the page was showing them.
  it('creates a record under the default name when the overview was left alone', async () => {
    const res = await save({ sections: { trophy: { trophy: [] } }, baselines: { trophy: { trophy: [] } } });

    expect(res.status).toEqual(200);
    expect(recordDao.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({ cube: cube.id, name: expect.stringMatching(/^Draft on \d{1,2} \w+, \d{4}$/) }),
    );
  });

  /**
   * Created in the state the client believes is stored, not the state it is submitting. The
   * delegated save compares what it finds against the submitted baselines and calls a
   * mismatch a concurrent edit — so creating from the submitted values would make the very
   * first save conflict with itself.
   */
  it('creates from the baseline, so the first save does not conflict with itself', async () => {
    const prefilled = { name: 'Draft on 4 November, 2026', date: overview.date, description: '' };

    const res = await save({
      sections: { overview: { ...overview, name: 'Renamed Night' } },
      baselines: { overview: prefilled },
    });

    expect(recordDao.createRecord).toHaveBeenCalledWith(expect.objectContaining({ name: prefilled.name }));
    expect(res.body.conflicts).toEqual([]);
    expect(res.body.applied).toEqual(expect.arrayContaining(['overview']));
    // The rename is what ends up stored, despite the record being created under the old name.
    expect((recordDao.update as jest.Mock).mock.calls[0][0].name).toEqual('Renamed Night');
  });

  it('creates nothing for a cube the user cannot edit', async () => {
    const res = await save(body(), { id: 'someone-else' });

    expect(res.status).toEqual(403);
    expect(recordDao.createRecord).not.toHaveBeenCalled();
  });

  it('creates nothing for a cube that does not exist', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(undefined);

    const res = await save(body());

    expect(res.status).toEqual(404);
    expect(recordDao.createRecord).not.toHaveBeenCalled();
  });

  // Nothing is stored yet, so every section the first save carries applies and none of them
  // can contest anything.
  it('applies everything the first save carries', async () => {
    const res = await save({
      sections: {
        overview,
        players: { players: [{ name: 'Alice' }, { name: 'Bob' }], seatOrder: [-1, -1] },
        trophy: { trophy: ['Alice'] },
      },
      // What the page loaded: the prefilled overview, and nothing else.
      baselines: { overview, players: { players: [], seatOrder: [] }, trophy: { trophy: [] } },
    });

    expect(res.status).toEqual(200);
    expect(res.body.conflicts).toEqual([]);
    expect(res.body.applied).toEqual(expect.arrayContaining(['overview', 'players', 'trophy']));
    expect(recordDao.update).toHaveBeenCalled();
  });
});
