import { deleteP1P1Handler } from '../../../src/router/routes/tool/api/deletep1p1';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  ...jest.requireActual('../../../src/dynamo/daos'),
  cubeDao: { getById: jest.fn() },
  p1p1PackDao: { getMetadataById: jest.fn(), deleteById: jest.fn() },
  commentDao: { queryByParent: jest.fn(), delete: jest.fn() },
}));

import { commentDao, cubeDao, p1p1PackDao } from '../../../src/dynamo/daos';

const OWNER = { id: 'owner-1', username: 'owner' } as any;
const PACK_ID = '00000000-0000-4000-8000-000000000001';

describe('deleteP1P1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (p1p1PackDao.getMetadataById as jest.Mock).mockResolvedValue({
      id: PACK_ID,
      cubeId: 'cube-1',
      createdBy: 'someone',
    });
    (commentDao.queryByParent as jest.Mock).mockResolvedValue({ items: [] });
  });

  it('lets cube collaborators delete', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue({ id: 'cube-1', owner: OWNER, collaborators: ['collab-1'] });

    const res = await call(deleteP1P1Handler)
      .as({ id: 'collab-1', username: 'collab' } as any)
      .withBody({ packId: PACK_ID })
      .send();

    expect(res.status).toBe(200);
    expect(p1p1PackDao.deleteById).toHaveBeenCalledWith(PACK_ID);
  });

  it('rejects users who cannot edit the cube and did not create the pack', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue({ id: 'cube-1', owner: OWNER, collaborators: [] });

    const res = await call(deleteP1P1Handler)
      .as({ id: 'stranger', username: 'stranger' } as any)
      .withBody({ packId: PACK_ID })
      .send();

    expect(res.status).toBe(403);
    expect(p1p1PackDao.deleteById).not.toHaveBeenCalled();
  });
});
