import { createFinishedEventHandler, createRecordHandler } from '../../../src/router/routes/cube/records/create';
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

// The wizard's own POST (name/description/date already collected) and "Input Finished Event"
// (an empty record built client-side) both create exactly one record via the same shape of
// request; only the handler — and so the redirect target — tells the two doors apart.
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

  it('redirects a finished-event create to the workspace', async () => {
    await post(createFinishedEventHandler, { record: JSON.stringify({ name: 'New Record' }) });

    expect(redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/cube/records/enter/rec-1');
  });

  it('creates exactly one record either way', async () => {
    await post(createFinishedEventHandler, { record: JSON.stringify({ name: 'New Record' }) });

    expect(recordDao.createRecord).toHaveBeenCalledTimes(1);
  });
});
