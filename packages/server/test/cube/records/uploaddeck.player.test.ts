jest.mock('serverutils/render', () => ({
  ...jest.requireActual('serverutils/render'),
  render: jest.fn(),
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
}));

jest.mock('serverutils/carddb', () => ({
  cardFromId: jest.fn(),
  getReasonableCardByOracle: jest.fn(),
  getVersionsByOracleId: jest.fn(() => []),
}));

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: { getById: jest.fn(), getCards: jest.fn(), update: jest.fn() },
  draftDao: { getById: jest.fn(), createDraft: jest.fn(), update: jest.fn() },
  recordDao: { getById: jest.fn(), update: jest.fn() },
  userDao: { getByUsername: jest.fn() },
}));

import { cubeDao, recordDao } from '../../../src/dynamo/daos';
import { uploadDeckPageHandler } from '../../../src/router/routes/cube/records/uploaddeck';
import { render } from '../../../src/serverutils/render';
import { createCube } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

describe('uploadDeckPageHandler', () => {
  const cube = createCube({ id: 'my-cube' });
  const record = {
    id: 'rec',
    cube: cube.id,
    players: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }, { name: 'Dave' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (recordDao.getById as jest.Mock).mockResolvedValue(record);
  });

  const openUploadPage = (query: any) =>
    call(uploadDeckPageHandler).as(cube.owner).withParams({ id: record.id }).withQuery(query).send();

  const renderedProps = () => (render as jest.Mock).mock.calls[0][3];

  it('passes initialPlayerIndex through from ?player', async () => {
    await openUploadPage({ player: '2' });

    expect(renderedProps()).toEqual(expect.objectContaining({ initialPlayerIndex: 2 }));
  });

  it('passes initialPlayerIndex through for the last player', async () => {
    await openUploadPage({ player: '4' });

    expect(renderedProps()).toEqual(expect.objectContaining({ initialPlayerIndex: 4 }));
  });

  it('omits initialPlayerIndex when the query param is absent', async () => {
    await openUploadPage({});

    expect(renderedProps()).not.toHaveProperty('initialPlayerIndex');
  });

  it('omits initialPlayerIndex when the index exceeds the player count', async () => {
    await openUploadPage({ player: '5' });

    expect(renderedProps()).not.toHaveProperty('initialPlayerIndex');
  });

  it('omits initialPlayerIndex when the index is below the first player', async () => {
    await openUploadPage({ player: '0' });

    expect(renderedProps()).not.toHaveProperty('initialPlayerIndex');
  });

  it('omits initialPlayerIndex when the query param is not a number', async () => {
    await openUploadPage({ player: 'Alice' });

    expect(renderedProps()).not.toHaveProperty('initialPlayerIndex');
  });
});
