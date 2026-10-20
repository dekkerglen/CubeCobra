import {
  csvHandler,
  cubecobraHandler,
  forgeHandler,
  mtgoHandler,
  plaintextHandler,
  versionedHandler,
  xmageHandler,
} from '../../src/router/routes/cube/download';
import { createCard, createCardDetails, createCube, createCustomCard, createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

jest.mock('../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    getCards: jest.fn(),
  },
}));

jest.mock('serverutils/cubefn', () => ({
  isCubeViewable: jest.fn(() => true),
}));

jest.mock('serverutils/carddb', () => ({
  cardFromId: jest.fn(),
}));

import { cubeDao } from '../../src/dynamo/daos';
import { cardFromId } from 'serverutils/carddb';

const bearsDetails = createCardDetails({ name: 'Grizzly Bears', type: 'Creature — Bear', color_identity: ['G'] });
const boltDetails = createCardDetails({ name: 'Lightning Bolt', type: 'Instant', color_identity: ['R'] });
// Mirror production: unknown ids (custom cards, vouchers) resolve to the typeless placeholder.
const placeholderDetails = createCardDetails({ name: 'Invalid Card', type: '', color_identity: [] });
const detailsById: Record<string, ReturnType<typeof createCardDetails>> = {
  'bears-id': bearsDetails,
  'bolt-id': boltDetails,
};

const bears = (overrides = {}) => createCard({ cardID: 'bears-id', details: bearsDetails, ...overrides });
const bolt = () => createCard({ cardID: 'bolt-id', details: boltDetails });
// No details, so every route resolves it through cardFromId like a production custom card.
const custom = () => createCustomCard('My Custom', { details: undefined });

const bearsOnlySort = {
  name: 'Bears Only',
  matchFirstOnly: true,
  categories: [{ label: 'Bears', filter: 'type:bear' }],
};

const download = async (handler: any, cube: any, cards: any[], query: Record<string, string> = {}) => {
  (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
  (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: cards });
  const res = await call(handler)
    .as(createUser())
    .withParams({ id: cube.id })
    .withQuery(query)
    .withFlash(jest.fn())
    .send();
  expect(res.status).toBe(200);
  return res.body as string;
};

const lines = (body: string) => body.split('\r\n').filter(Boolean);

beforeEach(() => {
  jest.clearAllMocks();
  (cardFromId as jest.Mock).mockImplementation((id: string) => detailsById[id] ?? placeholderDetails);
});

describe('GET /cube/download/cubecobra/:id', () => {
  const namesFor = async (cube: any, query: Record<string, string> = {}, cards = [bears(), custom()]) =>
    lines(await download(cubecobraHandler, cube, cards, query));

  it('includes unsorted cards when the cube shows them and no showother param is given', async () => {
    const names = await namesFor(createCube({ id: 'c1', showUnsorted: true }));
    expect(names).toEqual(expect.arrayContaining(['Grizzly Bears', 'My Custom']));
  });

  it('omits unsorted cards when the cube hides them and no showother param is given', async () => {
    const names = await namesFor(createCube({ id: 'c1', showUnsorted: false }));
    expect(names).toContain('Grizzly Bears');
    expect(names).not.toContain('My Custom');
  });

  it('lets an explicit showother param override the cube setting', async () => {
    const forcedOn = await namesFor(createCube({ id: 'c1', showUnsorted: false }), { showother: 'true' });
    expect(forcedOn).toEqual(expect.arrayContaining(['Grizzly Bears', 'My Custom']));

    const forcedOff = await namesFor(createCube({ id: 'c1', showUnsorted: true }), { showother: 'false' });
    expect(forcedOff).not.toContain('My Custom');
  });

  it('applies custom sorts defined on the cube, which require the cube to be resolvable', async () => {
    const cube = createCube({ id: 'c1', showUnsorted: false, customSorts: [bearsOnlySort] });

    const names = await namesFor(cube, { primary: 'Bears Only' });
    expect(names).toContain('Grizzly Bears');
  });

  it("sorts with the cube's own default sorts when no sort is given", async () => {
    const cube = createCube({
      id: 'c1',
      showUnsorted: false,
      customSorts: [bearsOnlySort],
      defaultSorts: ['Bears Only', 'Types-Multicolor', 'Mana Value', 'Alphabetical'],
    });

    await expect(namesFor(cube, {}, [bolt(), bears()])).resolves.toEqual(['Grizzly Bears']);
  });

  it('exports every card once in stored order when nosort is set', async () => {
    const cube = createCube({ id: 'c1', showUnsorted: false });

    await expect(namesFor(cube, { nosort: 'true' }, [custom(), bears({ tags: ['a', 'b'] })])).resolves.toEqual([
      'My Custom',
      'Grizzly Bears',
    ]);
  });

  it('still applies the filter when nosort is set', async () => {
    const cube = createCube({ id: 'c1', showUnsorted: false });

    await expect(namesFor(cube, { nosort: 'true', filter: 'type:bear' }, [bolt(), bears()])).resolves.toEqual([
      'Grizzly Bears',
    ]);
  });

  it('lists a card once per group it falls into, as the cube page does', async () => {
    const cube = createCube({ id: 'c1', showUnsorted: false });

    const names = await namesFor(cube, { primary: 'Tags' }, [bears({ tags: ['a', 'b'] })]);
    expect(names).toEqual(['Grizzly Bears', 'Grizzly Bears']);
  });
});

describe.each([
  ['forge', forgeHandler, 'My Custom'],
  ['xmage', xmageHandler, 'My Custom'],
  ['versioned', versionedHandler, 'My Custom'],
  ['plaintext', plaintextHandler, 'My Custom'],
  // MTGO lists cards by their catalog name, so a custom card appears as the placeholder.
  ['mtgo', mtgoHandler, 'Invalid Card'],
])('GET /cube/download/%s/:id', (_name, handler, customName) => {
  const cube = createCube({ id: 'c1', showUnsorted: false });

  it('omits cards the cube hides when sorting', async () => {
    const body = await download(handler, cube, [bears(), custom()]);
    expect(body).toContain('Grizzly Bears');
    expect(body).not.toContain(customName);
  });

  it('includes every card when nosort is set', async () => {
    const body = await download(handler, cube, [bears(), custom()], { nosort: 'true' });
    expect(body).toContain('Grizzly Bears');
    expect(body).toContain(customName);
  });

  it('applies the filter', async () => {
    const body = await download(handler, cube, [bears(), bolt()], { filter: 'type:bear' });
    expect(body).toContain('Grizzly Bears');
    expect(body).not.toContain('Lightning Bolt');
  });
});

describe('GET /cube/download/csv/:id', () => {
  const cube = createCube({ id: 'c1', showUnsorted: false });
  const rowNames = (body: string) =>
    lines(body)
      .slice(1)
      .map((line) => (line.split(',')[0] ?? '').replace(/"/g, ''));

  it('keeps every card once in stored order when no sort is given', async () => {
    const body = await download(csvHandler, cube, [custom(), bears({ tags: ['a', 'b'] }), bolt()], {
      showother: 'false',
    });
    expect(rowNames(body)).toEqual(['My Custom', 'Grizzly Bears', 'Lightning Bolt']);
  });

  it('omits cards the cube hides when a sort is given', async () => {
    const body = await download(csvHandler, cube, [bears(), custom()], { primary: 'Color Category' });
    expect(rowNames(body)).toEqual(['Grizzly Bears']);
  });

  it('applies the filter without a sort', async () => {
    const body = await download(csvHandler, cube, [bears(), bolt()], { filter: 'type:bear' });
    expect(rowNames(body)).toEqual(['Grizzly Bears']);
  });

  it('orders rows by the requested sort', async () => {
    const body = await download(csvHandler, cube, [bears(), bolt()], { primary: 'Color Category' });
    expect(rowNames(body)).toEqual(['Lightning Bolt', 'Grizzly Bears']);
  });

  it('keeps stored order when nosort is set', async () => {
    const body = await download(csvHandler, cube, [bears(), bolt()], { nosort: 'true' });
    expect(rowNames(body)).toEqual(['Grizzly Bears', 'Lightning Bolt']);
  });
});
