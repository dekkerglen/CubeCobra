import { importRecordHandler } from '../../../src/router/routes/cube/records/import';
import { getRecordsHandler } from '../../../src/router/routes/cube/records/list';
import { createCube, createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('serverutils/render', () => ({
  ...jest.requireActual('serverutils/render'),
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
}));

jest.mock('../../../src/router/routes/cube/records/uploaddeck', () => ({
  associateNewDraft: jest.fn(),
  associateWithExistingDraft: jest.fn(),
}));

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: { getById: jest.fn() },
  draftDao: { getById: jest.fn() },
  recordDao: { getById: jest.fn(), createRecord: jest.fn(), getByCube: jest.fn() },
}));

import { cubeDao, draftDao, recordDao } from '../../../src/dynamo/daos';
import { associateNewDraft, associateWithExistingDraft } from '../../../src/router/routes/cube/records/uploaddeck';

describe('importRecordHandler', () => {
  const cube = createCube({ id: 'my-cube' });
  const flash = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
  });

  const importInto = (recordId: string) =>
    call(importRecordHandler)
      .as(cube.owner)
      .withFlash(flash)
      .withParams({ id: cube.id })
      .withBody({
        newRecord: 'false',
        record: JSON.stringify({ id: recordId, name: 'Record' }),
        userIndex: '1',
        mainboard: JSON.stringify(['oracle-1']),
      })
      .send();

  it("refuses to write into another cube's record", async () => {
    (recordDao.getById as jest.Mock).mockResolvedValue({ id: 'victim', cube: 'other-cube', draft: 'victim-draft' });

    await importInto('victim');

    expect(flash).toHaveBeenCalledWith('danger', 'Record not found');
    expect(draftDao.getById).not.toHaveBeenCalled();
    expect(associateNewDraft).not.toHaveBeenCalled();
    expect(associateWithExistingDraft).not.toHaveBeenCalled();
  });

  it("refuses to write into a draft from another cube, even through this cube's record", async () => {
    (recordDao.getById as jest.Mock).mockResolvedValue({ id: 'mine', cube: cube.id, draft: 'victim-draft' });
    (draftDao.getById as jest.Mock).mockResolvedValue({ id: 'victim-draft', cube: 'other-cube', seats: [] });

    await importInto('mine');

    expect(flash).toHaveBeenCalledWith('danger', 'Record not found');
    expect(associateNewDraft).not.toHaveBeenCalled();
    expect(associateWithExistingDraft).not.toHaveBeenCalled();
  });

  it("uploads into this cube's record and draft", async () => {
    const record = { id: 'mine', cube: cube.id, draft: 'my-draft' };
    const draft = { id: 'my-draft', cube: cube.id, seats: [{ mainboard: [] }] };
    (recordDao.getById as jest.Mock).mockResolvedValue(record);
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    await importInto('mine');

    expect(associateWithExistingDraft).toHaveBeenCalledWith(cube, draft, 1, ['oracle-1'], []);
  });
});

describe('getRecordsHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides records of a private cube', async () => {
    const cube = createCube({ visibility: 'pr' });
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);

    const res = await call(getRecordsHandler).as(createUser()).withParams({ id: cube.id }).send();

    expect(res.status).toBe(404);
    expect(recordDao.getByCube).not.toHaveBeenCalled();
  });

  it('lists records using the loaded cube ID', async () => {
    const cube = createCube({ id: 'canonical-id', shortId: 'short' });
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (recordDao.getByCube as jest.Mock).mockResolvedValue({ items: [], lastKey: undefined });

    const res = await call(getRecordsHandler).as(createUser()).withParams({ id: 'short' }).send();

    expect(res.status).toBe(200);
    expect(recordDao.getByCube).toHaveBeenCalledWith('canonical-id', 20, undefined);
  });
});
