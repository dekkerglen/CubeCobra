import Card, { Changes } from '@utils/datatypes/Card';
import { buildMainboardHistory } from 'serverutils/mainboardHistory';

// Printing id → oracle id. a1/a2 are two printings of the same card.
const ORACLES: Record<string, string> = { a1: 'A', a2: 'A', b: 'B', c: 'C', d: 'D' };
const oracleOf = (cardID: string) => ORACLES[cardID] ?? '';
const card = (cardID: string) => ({ cardID }) as Card;

// Newest first, as the changelog index returns them.
const CHANGELOGS: { date: number; changelog: Changes }[] = [
  { date: 300, changelog: { mainboard: { adds: [card('c')], removes: [{ index: 0, oldCard: card('d') }] } } },
  {
    date: 200,
    changelog: { mainboard: { adds: [card('b')], swaps: [{ index: 0, oldCard: card('a1'), card: card('a2') }] } },
  },
  { date: 100, changelog: { mainboard: { adds: [card('a1'), card('d')] } } },
];

const sourceWithPageSize = (pageSize: number) => ({
  queryByCube: async (_cubeId: string, lastKey?: Record<string, any>) => {
    const start = lastKey?.offset ?? 0;
    const items = CHANGELOGS.slice(start, start + pageSize);
    const next = start + pageSize;
    return { items, lastKey: next < CHANGELOGS.length ? { offset: next } : undefined };
  },
  loadChangelogData: async (item: { date: number; changelog: Changes }) => item.changelog,
});

const CURRENT = [card('a2'), card('b'), card('c')];

describe('buildMainboardHistory', () => {
  it('rebuilds intervals across the full history', async () => {
    const history = await buildMainboardHistory('cube', CURRENT, 50, sourceWithPageSize(100), oracleOf);

    expect(history.start).toBe(100);
    expect(history.presence).toEqual({
      A: [[100, null]], // a printing swap is not a removal
      B: [[200, null]],
      C: [[300, null]],
      D: [[100, 300]],
    });
  });

  it('stops at the oldest record and leaves the start open', async () => {
    const history = await buildMainboardHistory('cube', CURRENT, 150, sourceWithPageSize(100), oracleOf);

    expect(history.start).toBe(0);
    expect(history.presence).toEqual({
      A: [[0, null]],
      B: [[200, null]],
      C: [[300, null]],
      D: [[0, 300]],
    });
  });

  it('walks multiple pages', async () => {
    const history = await buildMainboardHistory('cube', CURRENT, 50, sourceWithPageSize(1), oracleOf);

    expect(history.start).toBe(100);
    expect(history.presence.D).toEqual([[100, 300]]);
  });

  it('treats a cube with no changelog as unchanged', async () => {
    const history = await buildMainboardHistory(
      'cube',
      CURRENT,
      50,
      { queryByCube: async () => ({ items: [] }), loadChangelogData: async () => ({}) },
      oracleOf,
    );

    expect(history.start).toBe(0);
    expect(history.presence.A).toEqual([[0, null]]);
  });
});
