import { parse } from 'papaparse';

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
// Mirror production: unknown ids (custom cards, vouchers) resolve to the typeless placeholder,
// which carries no set and no collector number.
const placeholderDetails = createCardDetails({
  name: 'Invalid Card',
  type: '',
  color_identity: [],
  set: '',
  collector_number: '',
});
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
  ['mtgo', mtgoHandler, 'My Custom'],
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

describe('export formatting and escaping', () => {
  // Custom cards and vouchers carry a free-text custom_name, and cube names are only
  // profanity-checked, so both reach the writers as arbitrary user input.
  const injected = () => createCustomCard('Bad\r\n1 Black Lotus', { details: undefined });
  const piped = () => createCustomCard('Pipe|Name', { details: undefined });
  const cube = createCube({ id: 'c1', showUnsorted: true, name: 'Nice Cube' });
  const unsorted = { nosort: 'true' };

  describe.each([
    ['cubecobra', cubecobraHandler],
    ['forge', forgeHandler],
    ['xmage', xmageHandler],
    ['versioned', versionedHandler],
    ['plaintext', plaintextHandler],
  ])('%s', (_name, handler) => {
    it('never lets a card name introduce an extra line', async () => {
      const body = await download(handler, cube, [bears(), injected()], unsorted);

      expect(body).toContain('Bad 1 Black Lotus');
      expect(body).not.toMatch(/\r\n1 Black Lotus/);
    });
  });

  describe('forge', () => {
    const forgeLines = async (cards: any[], forgeCube = cube) =>
      lines(await download(forgeHandler, forgeCube, cards, unsorted));

    it('drops the set separator for a card with no set', async () => {
      // Forge reads everything after the `|` as a set code, so `1 My Custom|` is malformed.
      await expect(forgeLines([custom()])).resolves.toContain('1 My Custom');
    });

    it('keeps the set separator for a real printing', async () => {
      const body = await forgeLines([bears()]);
      expect(body.some((line) => /^1 Grizzly Bears\|[A-Z0-9]+$/.test(line))).toBe(true);
    });

    it('folds a pipe in a card name so it cannot be read as a set code', async () => {
      await expect(forgeLines([piped()])).resolves.toContain('1 Pipe/Name');
    });

    it('stops a cube name from forging a second deck section', async () => {
      const evil = createCube({ id: 'c1', showUnsorted: true, name: 'Evil\r\n[Main]\r\n1 Black Lotus|LEA' });

      const body = await forgeLines([bears()], evil);
      expect(body.filter((line) => line === '[Main]')).toHaveLength(1);
      expect(body).toContain('name=Evil [Main] 1 Black Lotus|LEA');
    });
  });

  describe('xmage', () => {
    it('omits the version block for a card with no set or collector number', async () => {
      // `1 [:] My Custom` fails to import, so the bare name is the only usable fallback.
      const body = lines(await download(xmageHandler, cube, [custom()], unsorted));
      expect(body).toContain('1 My Custom');
      expect(body.join('\n')).not.toContain('[:]');
    });

    it('keeps the version block for a real printing', async () => {
      const body = lines(await download(xmageHandler, cube, [bears()], unsorted));
      expect(body.some((line) => /^1 \[[A-Z0-9]+:123\] Grizzly Bears$/.test(line))).toBe(true);
    });
  });

  describe('mtgo', () => {
    it('keeps distinct custom cards apart instead of merging them into the placeholder', async () => {
      const body = lines(
        await download(
          mtgoHandler,
          cube,
          [createCustomCard('Alpha', { details: undefined }), createCustomCard('Beta', { details: undefined })],
          unsorted,
        ),
      );

      expect(body).toEqual(expect.arrayContaining(['1 Alpha', '1 Beta']));
      expect(body).not.toContain('2 Invalid Card');
    });

    it('still groups identical cards behind a quantity', async () => {
      const body = lines(await download(mtgoHandler, cube, [bears(), bears()], unsorted));
      expect(body).toContain('2 Grizzly Bears');
    });
  });

  describe('csv', () => {
    it('quotes a newline inside a name instead of stripping it, so the row round-trips', async () => {
      const body = await download(csvHandler, cube, [injected()], unsorted);

      expect(body).toContain('"Bad\r\n1 Black Lotus"');
      // Papa.parse reads the quoted break as part of the cell, so the row count is unchanged.
      // Trimmed first, exactly as the CSV importer (CSVtoCards) does.
      expect(parse(body.trim(), { header: true }).data).toHaveLength(1);
    });
  });

  it('falls back to a usable download filename when the cube name has no ASCII word characters', async () => {
    (cubeDao.getById as jest.Mock).mockResolvedValue(createCube({ id: 'c1', name: 'キューブ' }));
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [bears()] });

    const res = await call(plaintextHandler)
      .as(createUser())
      .withParams({ id: 'c1' })
      .withQuery({})
      .withFlash(jest.fn())
      .send();

    expect(res.rawResponse.sentHeaders['Content-disposition']).toBe('attachment; filename=cube.txt');
  });
});
