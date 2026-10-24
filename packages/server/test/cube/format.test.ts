import {
  MAX_FORMAT_PACKS,
  MAX_PACK_SLOTS,
  sanitizeDraftFormat,
  updateDraftFormatsHandler,
} from '../../src/router/routes/cube/format/update';
import { createCube } from '../test-utils/data';
import { call } from '../test-utils/transport';

jest.mock('serverutils/render', () => ({
  ...jest.requireActual('serverutils/render'),
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
}));

jest.mock('../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    update: jest.fn(),
  },
}));

import { cubeDao } from '../../src/dynamo/daos';

const pack = (slots = 1) => ({
  slots: Array.from({ length: slots }, () => ({ filter: '*' })),
  steps: [
    { action: 'pick', amount: slots },
    { action: 'endpack', amount: null },
  ],
});

const validFormat = (overrides: Record<string, unknown> = {}) => ({
  title: 'My Format',
  packs: [pack(3)],
  multiples: false,
  markdown: 'A *nice* format',
  defaultSeats: 8,
  ...overrides,
});

describe('sanitizeDraftFormat', () => {
  it('keeps only known fields', () => {
    const { format } = sanitizeDraftFormat(
      validFormat({
        html: '<script>alert(1)</script>',
        evil: 'x',
        basicsBoard: 'Basics',
        packs: [{ ...pack(1), randomizeOrder: true, extra: 1, slots: [{ filter: 'c:r', board: 'mainboard', x: 1 }] }],
      }),
    );

    expect(format).toEqual({
      title: 'My Format',
      packs: [
        {
          slots: [{ filter: 'c:r' }],
          steps: [
            { action: 'pick', amount: 1 },
            { action: 'endpack', amount: null },
          ],
          randomizeOrder: true,
        },
      ],
      multiples: false,
      markdown: 'A *nice* format',
      defaultSeats: 8,
      basicsBoard: 'Basics',
    });
  });

  it('keeps a sanitized legacy html description only when there is no markdown', () => {
    const { format } = sanitizeDraftFormat(
      validFormat({
        markdown: '',
        html: '<p onclick="steal()">Hi <b>all</b><img src=x onerror=alert(1)><script>alert(2)</script><a href="javascript:alert(3)">x</a><a href="https://example.com">y</a></p>',
      }),
    );

    expect(format?.markdown).toBeUndefined();
    expect(format?.html).toBe('<p>Hi <b>all</b><a>x</a><a href="https://example.com">y</a></p>');
  });

  it('clamps the default seat count and truncates long text', () => {
    const { format } = sanitizeDraftFormat(
      validFormat({ defaultSeats: 99, title: 'T'.repeat(500), markdown: 'm'.repeat(30_000) }),
    );
    expect(format?.defaultSeats).toBe(16);
    expect(format?.title).toHaveLength(200);
    expect(format?.markdown).toHaveLength(20_000);
  });

  it.each([
    ['a missing title', validFormat({ title: '' })],
    ['a non-object format', 'nope'],
    ['no packs', validFormat({ packs: [] })],
    ['too many packs', validFormat({ packs: Array.from({ length: MAX_FORMAT_PACKS + 1 }, () => pack(1)) })],
    ['too many slots', validFormat({ packs: [pack(MAX_PACK_SLOTS + 1)] })],
    ['a filter that is too long', validFormat({ packs: [{ slots: [{ filter: 'x'.repeat(501) }], steps: null }] })],
    ['an unknown step action', validFormat({ packs: [{ slots: [{ filter: '' }], steps: [{ action: 'steal' }] }] })],
    [
      'a huge step amount',
      validFormat({ packs: [{ slots: [{ filter: '' }], steps: [{ action: 'pick', amount: 1e9 }] }] }),
    ],
    ['a malformed pack', validFormat({ packs: [null] })],
  ])('rejects %s', (_label, raw) => {
    const { format, error } = sanitizeDraftFormat(raw);
    expect(format).toBeUndefined();
    expect(error).toEqual(expect.any(String));
  });
});

describe('updateDraftFormatsHandler', () => {
  const flash = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists sanitized formats only', async () => {
    const cube = createCube();
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);

    await call(updateDraftFormatsHandler)
      .as(cube.owner)
      .withFlash(flash)
      .withParams({ id: cube.id })
      .withBody({ formats: JSON.stringify([validFormat({ html: '<img src=x onerror=alert(1)>' })]) })
      .send();

    expect(cubeDao.update).toHaveBeenCalledTimes(1);
    const saved = (cubeDao.update as jest.Mock).mock.calls[0][0];
    expect(saved.formats).toHaveLength(1);
    expect(saved.formats[0].html).toBeUndefined();
    expect(flash).toHaveBeenCalledWith('success', expect.any(String));
  });

  it('rejects an oversized format without saving', async () => {
    const cube = createCube();
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);

    await call(updateDraftFormatsHandler)
      .as(cube.owner)
      .withFlash(flash)
      .withParams({ id: cube.id })
      .withBody({ formats: JSON.stringify([validFormat({ packs: [pack(MAX_PACK_SLOTS + 1)] })]) })
      .send();

    expect(cubeDao.update).not.toHaveBeenCalled();
    expect(flash).toHaveBeenCalledWith('danger', expect.stringContaining('at most'));
  });
});
