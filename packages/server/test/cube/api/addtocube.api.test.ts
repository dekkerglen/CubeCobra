import { PrintingPreference } from '@utils/datatypes/Card';
import { cardFromId, getMostReasonableById } from 'serverutils/carddb';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';

import { addtocubeHandler } from '../../../src/router/routes/cube/api/addtocube';
import { createCardDetails, createCube, createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  blogDao: { createBlog: jest.fn() },
  changelogDao: { createChangelog: jest.fn() },
  cubeDao: { getById: jest.fn(), getCards: jest.fn(), updateCards: jest.fn(), getAllLikers: jest.fn() },
  feedDao: { batchPutUnhydrated: jest.fn() },
  packageDao: { getById: jest.fn() },
  userDao: { getAllFollowers: jest.fn() },
}));
jest.mock('serverutils/carddb');
jest.mock('serverutils/cubefn');

import { changelogDao, cubeDao } from '../../../src/dynamo/daos';

// The printing the package itself stores, and the printing the cube's preference should pick instead.
const PACKAGE_PRINTING_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const PREFERRED_PRINTING_ID = 'bbbbbbbb-0000-0000-0000-000000000002';

const setupCube = (overrides?: Parameters<typeof createCube>[0]) => {
  const owner = createUser();
  const cube = createCube({ owner, defaultPrinting: PrintingPreference.RECENT, ...overrides });

  (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
  (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [], maybeboard: [] });
  (cubeDao.updateCards as jest.Mock).mockResolvedValue(undefined);
  (changelogDao.createChangelog as jest.Mock).mockResolvedValue('changelog-id');
  (isCubeViewable as jest.Mock).mockReturnValue(true);
  (isCubeEditable as jest.Mock).mockReturnValue(true);
  (cardFromId as jest.Mock).mockImplementation((id: string) =>
    createCardDetails({ scryfall_id: id, name: 'Lightning Bolt' }),
  );

  return { cube, owner };
};

const addedCardIds = (): string[] =>
  ((cubeDao.updateCards as jest.Mock).mock.calls[0][1].mainboard as { cardID: string }[]).map((card) => card.cardID);

describe('POST /cube/api/addtocube/:id', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('keeps the package printing when useDefaultPrinting is not set', async () => {
    const { cube, owner } = setupCube();

    const res = await call(addtocubeHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ cards: [PACKAGE_PRINTING_ID] })
      .send();

    expect(res.status).toEqual(200);
    expect(addedCardIds()).toEqual([PACKAGE_PRINTING_ID]);
    expect(getMostReasonableById).not.toHaveBeenCalled();
  });

  it("replaces the package printing with the cube's default printing when useDefaultPrinting is set", async () => {
    const { cube, owner } = setupCube();
    (getMostReasonableById as jest.Mock).mockReturnValue(createCardDetails({ scryfall_id: PREFERRED_PRINTING_ID }));

    const res = await call(addtocubeHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ cards: [PACKAGE_PRINTING_ID], useDefaultPrinting: true })
      .send();

    expect(res.status).toEqual(200);
    expect(getMostReasonableById).toHaveBeenCalledWith(PACKAGE_PRINTING_ID, PrintingPreference.RECENT);
    expect(addedCardIds()).toEqual([PREFERRED_PRINTING_ID]);
  });

  it('falls back to the package printing when the cube preference resolves nothing', async () => {
    const { cube, owner } = setupCube();
    (getMostReasonableById as jest.Mock).mockReturnValue(null);

    const res = await call(addtocubeHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ cards: [PACKAGE_PRINTING_ID], useDefaultPrinting: true })
      .send();

    expect(res.status).toEqual(200);
    expect(addedCardIds()).toEqual([PACKAGE_PRINTING_ID]);
  });

  it('falls back to the site default preference when the cube has none stored', async () => {
    const { cube, owner } = setupCube({ defaultPrinting: '' });
    (getMostReasonableById as jest.Mock).mockReturnValue(createCardDetails({ scryfall_id: PREFERRED_PRINTING_ID }));

    await call(addtocubeHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ cards: [PACKAGE_PRINTING_ID], useDefaultPrinting: true })
      .send();

    expect(getMostReasonableById).toHaveBeenCalledWith(PACKAGE_PRINTING_ID, PrintingPreference.DEFAULT);
  });

  it('applies the cube preference to card objects as well as bare ids', async () => {
    const { cube, owner } = setupCube();
    (getMostReasonableById as jest.Mock).mockReturnValue(createCardDetails({ scryfall_id: PREFERRED_PRINTING_ID }));

    await call(addtocubeHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ cards: [{ cardID: PACKAGE_PRINTING_ID, tags: ['Custom'] }], useDefaultPrinting: true })
      .send();

    expect(addedCardIds()).toEqual([PREFERRED_PRINTING_ID]);
  });
});
