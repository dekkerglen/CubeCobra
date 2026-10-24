import { CUBE_VISIBILITY } from '@utils/datatypes/Cube';

import {
  getMoreChangelogsHandler,
  getMoreDecksHandler,
  p1p1Handler,
  routes as cubeRoutes,
} from '../../src/router/routes/cube';
import { addsHandler } from '../../src/router/routes/cube/api/adds';
import { cutsHandler } from '../../src/router/routes/cube/api/cuts';
import { usercubesHandler } from '../../src/router/routes/cube/api/usercubes';
import { handler as likedHandler } from '../../src/router/routes/cube/liked';
import { getMoreP1P1sHandler } from '../../src/router/routes/tool/api/getmorep1p1s';
import { getCardImageForCubeHandler } from '../../src/router/routes/tool/cardimageforcube';
import { createCube, createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

jest.mock('serverutils/render', () => ({
  ...jest.requireActual('serverutils/render'),
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
  render: jest.fn(),
}));

jest.mock('serverutils/ml', () => ({
  recommend: jest.fn().mockResolvedValue({ adds: [], cuts: [] }),
  recommendOrThrow: jest.fn().mockResolvedValue({ adds: [], totalAdds: 0 }),
}));

jest.mock('../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    getCards: jest.fn(),
    queryByOwner: jest.fn(),
    queryCubesLikedBy: jest.fn(),
    batchGet: jest.fn(),
  },
  changelogDao: { queryByCubeWithData: jest.fn() },
  draftDao: { queryByCubeUnhydrated: jest.fn() },
  p1p1PackDao: { getById: jest.fn(), queryByCube: jest.fn() },
  userDao: { getByIdOrUsername: jest.fn(), getFollow: jest.fn() },
  patronDao: { getById: jest.fn() },
  packageDao: { countByVoter: jest.fn().mockResolvedValue(0) },
}));

import { changelogDao, cubeDao, draftDao, p1p1PackDao, userDao } from '../../src/dynamo/daos';
import { redirect, render } from '../../src/serverutils/render';

const owner = createUser();
const stranger = createUser();
const privateCube = createCube({ id: 'private-cube', owner, visibility: CUBE_VISIBILITY.PRIVATE });
const publicCube = createCube({ id: 'public-cube', owner, visibility: CUBE_VISIBILITY.PUBLIC });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /cube/getmorechangelogs', () => {
  it('hides the changelog of a private cube', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(privateCube);

    const res = await call(getMoreChangelogsHandler).as(stranger).withBody({ cubeId: privateCube.id }).send();

    expect(res.status).toBe(404);
    expect(changelogDao.queryByCubeWithData).not.toHaveBeenCalled();
  });

  it('does not let the page key choose the cube', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(undefined);

    const res = await call(getMoreChangelogsHandler)
      .as(stranger)
      .withBody({ lastKey: { cube: privateCube.id, GSI1PK: `CHANGELOG#CUBE#${privateCube.id}` } })
      .send();

    expect(res.status).toBe(400);
    expect(changelogDao.queryByCubeWithData).not.toHaveBeenCalled();
  });

  it("rejects a page key from another cube's history", async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(publicCube);

    const res = await call(getMoreChangelogsHandler)
      .as(stranger)
      .withBody({ cubeId: publicCube.id, lastKey: { GSI1PK: `CHANGELOG#CUBE#${privateCube.id}` } })
      .send();

    expect(res.status).toBe(400);
    expect(changelogDao.queryByCubeWithData).not.toHaveBeenCalled();
  });

  it('pages a viewable cube by its loaded ID', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(publicCube);
    (changelogDao.queryByCubeWithData as jest.Mock).mockResolvedValue({ items: [], lastKey: undefined });
    const lastKey = { PK: 'CHANGELOG#1', SK: 'CHANGELOG', GSI1PK: `CHANGELOG#CUBE#${publicCube.id}`, GSI1SK: 'DATE#1' };

    const res = await call(getMoreChangelogsHandler)
      .as(stranger)
      .withBody({ cubeId: publicCube.shortId, lastKey })
      .send();

    expect(res.status).toBe(200);
    expect(changelogDao.queryByCubeWithData).toHaveBeenCalledWith(publicCube.id, lastKey, 18);
  });
});

describe('POST /cube/getmoredecks/:id', () => {
  it('hides the decks of a private cube', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(privateCube);

    const res = await call(getMoreDecksHandler).as(stranger).withParams({ id: privateCube.id }).send();

    expect(res.status).toBe(404);
    expect(draftDao.queryByCubeUnhydrated).not.toHaveBeenCalled();
  });

  it('lets the owner page their decks', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(privateCube);
    (draftDao.queryByCubeUnhydrated as jest.Mock).mockResolvedValue({ items: [] });

    const res = await call(getMoreDecksHandler).as(owner).withParams({ id: privateCube.id }).send();

    expect(res.status).toBe(200);
    expect(draftDao.queryByCubeUnhydrated).toHaveBeenCalledWith(privateCube.id, undefined);
  });
});

describe('GET /cube/p1p1/:packId', () => {
  it("doesn't render a pack from a private cube", async () => {
    (p1p1PackDao.getById as jest.Mock).mockResolvedValue({ id: 'pack', cubeId: privateCube.id, cards: [] });
    (cubeDao.getById as jest.Mock).mockResolvedValue(privateCube);

    await call(p1p1Handler).as(stranger).withFlash(jest.fn()).withParams({ packId: 'pack' }).send();

    expect(render).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/404');
  });
});

describe('pack image routes', () => {
  it.each(['/samplepackimage/:id/:seed', '/p1p1packimage/:packId'])('rate limits %s', (path) => {
    const route = cubeRoutes.find((r) => r.path === path)!;
    expect(route.handler).toHaveLength(2);
  });
});

describe('POST /cube/api/cuts and /cube/api/adds', () => {
  it.each([
    ['cuts', cutsHandler],
    ['adds', addsHandler],
  ])('%s hides a private cube', async (_name, handler) => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(privateCube);

    const res = await call(handler).as(stranger).withBody({ cubeID: privateCube.id, filterText: 't:creature' }).send();

    expect(res.status).toBe(404);
    expect(cubeDao.getCards).not.toHaveBeenCalled();
  });

  it('cuts reads cards by the loaded cube ID', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(publicCube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [] });

    const res = await call(cutsHandler).as(stranger).withBody({ cubeID: publicCube.shortId }).send();

    expect(res.status).toBe(200);
    expect(cubeDao.getCards).toHaveBeenCalledWith(publicCube.id, publicCube);
  });
});

describe('POST /tool/api/getmorep1p1s/:cubeId', () => {
  it('hides the packs of a private cube', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(privateCube);

    const res = await call(getMoreP1P1sHandler).as(stranger).withParams({ cubeId: privateCube.id }).send();

    expect(res.status).toBe(404);
    expect(p1p1PackDao.queryByCube).not.toHaveBeenCalled();
  });
});

describe('GET /tool/cardimageforcube/:id/:cubeid', () => {
  it("doesn't reveal whether a private cube contains a card", async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(privateCube);

    await call(getCardImageForCubeHandler)
      .as(stranger)
      .withFlash(jest.fn())
      .withParams({ id: 'Lightning Bolt', cubeid: privateCube.id })
      .send();

    expect(cubeDao.getCards).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/404');
  });
});

describe('cube lists hide unlisted cubes', () => {
  const unlisted = createCube({ owner, visibility: CUBE_VISIBILITY.UNLISTED });
  const listed = createCube({ owner, visibility: CUBE_VISIBILITY.PUBLIC });

  it('usercubes shows unlisted cubes only to their owner', async () => {
    (cubeDao.queryByOwner as jest.Mock).mockResolvedValue({ items: [unlisted, listed, privateCube] });

    const asStranger = await call(usercubesHandler).as(stranger).withParams({ id: owner.id }).send();
    expect(asStranger.body.cubes.map((c: any) => c.id)).toEqual([listed.id]);

    const asOwner = await call(usercubesHandler).as(owner).withParams({ id: owner.id }).send();
    expect(asOwner.body.cubes).toHaveLength(3);
  });

  it('liked cubes hides unlisted cubes from other visitors', async () => {
    const liker = createUser();
    const othersUnlisted = createCube({ visibility: CUBE_VISIBILITY.UNLISTED });
    (userDao.getByIdOrUsername as jest.Mock).mockResolvedValue(liker);
    (cubeDao.queryCubesLikedBy as jest.Mock).mockResolvedValue({ cubeIds: [] });
    (cubeDao.batchGet as jest.Mock).mockResolvedValue([othersUnlisted, listed, privateCube]);

    await call(likedHandler).as(stranger).withParams({ userid: liker.id }).send();
    expect((render as jest.Mock).mock.calls[0][3].cubes.map((c: any) => c.id)).toEqual([listed.id]);

    await call(likedHandler).as(liker).withParams({ userid: liker.id }).send();
    expect((render as jest.Mock).mock.calls[1][3].cubes.map((c: any) => c.id)).toEqual([othersUnlisted.id, listed.id]);
  });
});
