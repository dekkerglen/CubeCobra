import { createRecordHandler } from '../../../src/router/routes/cube/records/create';
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

import { cubeDao, recordDao } from '../../../src/dynamo/daos';
import { redirect } from '../../../src/serverutils/render';

// "Start an Event" collects a name, description and date and then creates the record. The
// other door, "Input Finished Event", no longer passes through here at all: it opens the
// transcription workspace, which collects the same three things itself, and whose first Save
// is what creates the record (see enterNew.test.ts).
describe('create-record entry-point redirects', () => {
  const cube = createCube({ id: 'my-cube' });
  const flash = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (recordDao.createRecord as jest.Mock).mockResolvedValue('rec-1');
  });

  const post = (handler: typeof createRecordHandler, body: Record<string, unknown>) =>
    call(handler).as(cube.owner).withFlash(flash).withParams({ id: cube.id }).withBody(body).send();

  it('still redirects a wizard create to the record page', async () => {
    await post(createRecordHandler, { record: JSON.stringify({ name: 'Friday Draft' }) });

    expect(redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/cube/record/rec-1');
  });

  it('creates exactly one record', async () => {
    await post(createRecordHandler, { record: JSON.stringify({ name: 'Friday Draft' }) });

    expect(recordDao.createRecord).toHaveBeenCalledTimes(1);
  });
});
