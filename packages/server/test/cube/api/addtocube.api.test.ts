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

import { blogDao, changelogDao, cubeDao, feedDao, packageDao, userDao } from '../../../src/dynamo/daos';

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
  (blogDao.createBlog as jest.Mock).mockResolvedValue('blog-id');
  (cubeDao.getAllLikers as jest.Mock).mockResolvedValue([]);
  (userDao.getAllFollowers as jest.Mock).mockResolvedValue([]);
  (feedDao.batchPutUnhydrated as jest.Mock).mockResolvedValue(undefined);
  (isCubeViewable as jest.Mock).mockReturnValue(true);
  (isCubeEditable as jest.Mock).mockReturnValue(true);
  (cardFromId as jest.Mock).mockImplementation((id: string) =>
    createCardDetails({ scryfall_id: id, name: 'Lightning Bolt' }),
  );

  return { cube, owner };
};

const addedCardIds = (): string[] =>
  ((cubeDao.updateCards as jest.Mock).mock.calls[0][1].mainboard as { cardID: string }[]).map((card) => card.cardID);

const addedCardStatuses = (): string[] =>
  ((cubeDao.updateCards as jest.Mock).mock.calls[0][1].mainboard as { status: string }[]).map((card) => card.status);

const addedCardNotes = (): (string | undefined)[] =>
  ((cubeDao.updateCards as jest.Mock).mock.calls[0][1].mainboard as { notes?: string }[]).map((card) => card.notes);

const addedCardTags = (): string[][] =>
  ((cubeDao.updateCards as jest.Mock).mock.calls[0][1].mainboard as { tags: string[] }[]).map((card) => card.tags);

const PACK_ID = 'pack-1';
const PACK_TITLE = 'Sweet Package';
const withPackage = () => (packageDao.getById as jest.Mock).mockResolvedValue({ id: PACK_ID, title: PACK_TITLE });

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

  it("gives added cards the cube's default status", async () => {
    const { cube, owner } = setupCube({ defaultStatus: 'Proxied' });

    await call(addtocubeHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ cards: [PACKAGE_PRINTING_ID] })
      .send();

    expect(addedCardStatuses()).toEqual(['Proxied']);
  });

  it('falls back to Owned when the cube has no default status', async () => {
    const { cube, owner } = setupCube({ defaultStatus: undefined });

    await call(addtocubeHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ cards: [PACKAGE_PRINTING_ID] })
      .send();

    expect(addedCardStatuses()).toEqual(['Owned']);
  });

  it('lets a per-card status override the cube default', async () => {
    const { cube, owner } = setupCube({ defaultStatus: 'Proxied' });

    await call(addtocubeHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ cards: [{ cardID: PACKAGE_PRINTING_ID, status: 'Borrowed' }] })
      .send();

    expect(addedCardStatuses()).toEqual(['Borrowed']);
  });

  it('notes where a package card came from by default', async () => {
    const { cube, owner } = setupCube();
    withPackage();

    await call(addtocubeHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ cards: [PACKAGE_PRINTING_ID], packid: PACK_ID })
      .send();

    expect(addedCardNotes()[0]).toContain(`Added from package "${PACK_TITLE}"`);
    expect(addedCardNotes()[0]).toContain(`/packages/${PACK_ID}`);
  });

  it('omits the note when addNotes is false', async () => {
    const { cube, owner } = setupCube();
    withPackage();

    await call(addtocubeHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ cards: [PACKAGE_PRINTING_ID], packid: PACK_ID, addNotes: false })
      .send();

    expect(addedCardNotes()).toEqual([undefined]);
  });

  it('still notes the origin package when autotagging is off', async () => {
    const { cube, owner } = setupCube();
    withPackage();

    await call(addtocubeHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ cards: [PACKAGE_PRINTING_ID], packid: PACK_ID, autoTag: false })
      .send();

    expect(addedCardTags()).toEqual([[]]);
    expect(addedCardNotes()[0]).toContain(`Added from package "${PACK_TITLE}"`);
  });

  it('still tags with the package name when notes are off', async () => {
    const { cube, owner } = setupCube();
    withPackage();

    await call(addtocubeHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ cards: [PACKAGE_PRINTING_ID], packid: PACK_ID, addNotes: false })
      .send();

    expect(addedCardTags()).toEqual([[PACK_TITLE]]);
  });

  it('writes no note when the cards did not come from a package', async () => {
    const { cube, owner } = setupCube();

    await call(addtocubeHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ cards: [PACKAGE_PRINTING_ID] })
      .send();

    expect(addedCardNotes()).toEqual([undefined]);
  });

  it('blogs about the package by default', async () => {
    const { cube, owner } = setupCube();
    withPackage();

    await call(addtocubeHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ cards: [PACKAGE_PRINTING_ID], packid: PACK_ID })
      .send();

    expect(blogDao.createBlog).toHaveBeenCalledWith(
      expect.objectContaining({ title: `Added Package "${PACK_TITLE}"` }),
    );
  });

  it('skips the blog post when createBlogPost is false', async () => {
    const { cube, owner } = setupCube();
    withPackage();

    await call(addtocubeHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ cards: [PACKAGE_PRINTING_ID], packid: PACK_ID, createBlogPost: false })
      .send();

    expect(blogDao.createBlog).not.toHaveBeenCalled();
  });

  it('still blogs about the package when autotagging is off', async () => {
    const { cube, owner } = setupCube();
    withPackage();

    await call(addtocubeHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ cards: [PACKAGE_PRINTING_ID], packid: PACK_ID, autoTag: false })
      .send();

    expect(blogDao.createBlog).toHaveBeenCalledWith(
      expect.objectContaining({ title: `Added Package "${PACK_TITLE}"` }),
    );
  });

  it('writes no blog post when the cards did not come from a package', async () => {
    const { cube, owner } = setupCube();

    await call(addtocubeHandler)
      .as(owner)
      .withParams({ id: cube.id })
      .withBody({ cards: [PACKAGE_PRINTING_ID] })
      .send();

    expect(blogDao.createBlog).not.toHaveBeenCalled();
  });
});
