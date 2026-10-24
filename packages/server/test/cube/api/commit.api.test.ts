import { commitHandler } from '../../../src/router/routes/cube/api/commit';
import { createCardWithoutDetails, createCube } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
    getCards: jest.fn(),
    commitCards: jest.fn(),
    getAllLikers: jest.fn().mockResolvedValue([]),
  },
  blogDao: { createBlog: jest.fn() },
  feedDao: { batchPutUnhydrated: jest.fn() },
  userDao: { getAllFollowers: jest.fn().mockResolvedValue([]) },
}));

import { cubeDao } from '../../../src/dynamo/daos';

describe('POST /cube/api/commit', () => {
  const cube = createCube({ version: 3 });
  let cards: Record<string, any>;

  beforeEach(() => {
    jest.clearAllMocks();
    cards = {
      mainboard: [createCardWithoutDetails({ cardID: 'a' }), createCardWithoutDetails({ cardID: 'b' })],
      maybeboard: [],
    };
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue(cards);
    (cubeDao.commitCards as jest.Mock).mockResolvedValue({ version: 4, changelogId: 'log' });
  });

  const commit = (changes: unknown) =>
    call(commitHandler).as(cube.owner).withBody({ id: cube.id, changes, expectedVersion: 3 }).send();

  it('applies valid changes', async () => {
    const res = await commit({
      version: 3,
      mainboard: {
        swaps: [{ index: 0, card: { cardID: 'c' } }],
        edits: [{ index: 1, newCard: { cardID: 'b', notes: 'hi' } }],
        adds: [{ cardID: 'd' }],
      },
    });

    expect(res.status).toBe(200);
    const saved = (cubeDao.commitCards as jest.Mock).mock.calls[0][1];
    expect(saved.mainboard.map((card: any) => card.cardID)).toEqual(['c', 'b', 'd']);
    expect(saved.mainboard[1].notes).toBe('hi');
  });

  it('adds to a default board that does not exist yet', async () => {
    const res = await commit({ basics: { adds: [{ cardID: 'plains' }] } });

    expect(res.status).toBe(200);
    expect((cubeDao.commitCards as jest.Mock).mock.calls[0][1].basics).toEqual([{ cardID: 'plains' }]);
  });

  it.each([['__proto__'], ['constructor'], ['prototype'], ['hasOwnProperty'], ['notaboard']])(
    'rejects changes to the %s board without touching Object.prototype',
    async (board) => {
      const changes = JSON.parse(`{"${board}": {"swaps": [{"index": 0, "card": {"cardID": "x", "polluted": true}}]}}`);

      const res = await commit(changes);

      expect(res.status).toBe(400);
      expect(cubeDao.commitCards).not.toHaveBeenCalled();
      expect(({} as any).polluted).toBeUndefined();
      expect((Object.prototype as any)[0]).toBeUndefined();
    },
  );

  it.each([
    ['a swap past the end', { swaps: [{ index: 2, card: { cardID: 'x' } }] }],
    ['a negative edit', { edits: [{ index: -1, newCard: { cardID: 'x' } }] }],
    ['a fractional remove', { removes: [{ index: 0.5 }] }],
    ['a string index', { removes: [{ index: 'length' }] }],
    ['a huge index', { swaps: [{ index: 1e9, card: { cardID: 'x' } }] }],
    ['an add without a card ID', { adds: [{ notes: 'x' }] }],
    ['a swap without a card', { swaps: [{ index: 0 }] }],
    ['an edit without a card', { edits: [{ index: 0, newCard: 'x' }] }],
    ['a non-array op list', { removes: { index: 0 } }],
  ])('rejects %s', async (_label, boardChanges) => {
    const res = await commit({ mainboard: boardChanges });

    expect(res.status).toBe(400);
    expect(cubeDao.commitCards).not.toHaveBeenCalled();
  });

  it('ignores the non-board version key', async () => {
    const res = await commit({
      version: { swaps: [{ index: 99, card: { cardID: 'x' } }] },
      mainboard: { removes: [{ index: 0 }] },
    });

    expect(res.status).toBe(200);
    expect((cubeDao.commitCards as jest.Mock).mock.calls[0][1].mainboard.map((c: any) => c.cardID)).toEqual(['b']);
  });

  it('drops custom image URLs that are not http(s)', async () => {
    const res = await commit({
      mainboard: {
        adds: [
          { cardID: 'd', imgUrl: 'http://example.com/d.png', imgBackUrl: 'file:///etc/passwd' },
          { cardID: 'e', imgUrl: `https://example.com/${'a'.repeat(3000)}.png` },
          { cardID: 'f', voucher_cards: [{ cardID: 'g', imgUrl: 'javascript:alert(1)' }] },
        ],
        edits: [{ index: 0, newCard: { cardID: 'a', imgUrl: 'gopher://internal', imgBackUrl: '' } }],
      },
    });

    expect(res.status).toBe(200);
    const [a, , d, e, f] = (cubeDao.commitCards as jest.Mock).mock.calls[0][1].mainboard;
    expect(d.imgUrl).toBe('http://example.com/d.png');
    expect(d).not.toHaveProperty('imgBackUrl');
    expect(e).not.toHaveProperty('imgUrl');
    expect(f.voucher_cards[0]).not.toHaveProperty('imgUrl');
    expect(a).not.toHaveProperty('imgUrl');
    expect(a.imgBackUrl).toBe('');
  });

  it('does not leak internal error details', async () => {
    (cubeDao.commitCards as jest.Mock).mockRejectedValue(new Error('arn:aws:secret-table'));

    const res = await commit({ mainboard: { adds: [{ cardID: 'd' }] } });

    expect(res.status).toBe(500);
    expect(res.body.message).not.toContain('arn:aws');
  });
});
