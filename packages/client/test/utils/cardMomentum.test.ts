import HistoryType from '@utils/datatypes/History';

import { eloMomentum, eloSeries, playRateMomentum, playRateSeries } from 'utils/cardMomentum';

const DAY_MS = 24 * 60 * 60 * 1000;
const ANCHOR = new Date('2026-10-25T00:00:00Z').valueOf();

// Weekly snapshots are only written when the history job runs on a Sunday, so the
// helper places rows by age rather than letting array position stand in for a date.
const weeklyEntry = (weeksAgo: number, overrides: Partial<HistoryType> = {}): HistoryType =>
  ({
    OTComp: 'oracle-123:week',
    oracle: 'oracle-123',
    date: ANCHOR - weeksAgo * 7 * DAY_MS,
    picks: 0,
    cubes: 0,
    vintage: [50, 1000],
    legacy: [50, 1000],
    modern: [50, 1000],
    pioneer: [50, 1000],
    peasant: [50, 1000],
    pauper: [50, 1000],
    size180: [50, 1000],
    size360: [50, 1000],
    size450: [50, 1000],
    size540: [50, 1000],
    size720: [50, 1000],
    total: [50, 1000],
    cubeCount: [50, 1000],
    elo: 1200,
    ...overrides,
  }) as HistoryType;

describe('playRateMomentum', () => {
  it('compares the trailing window average against the window before it', () => {
    const history = [
      weeklyEntry(7, { total: [50, 1000] }),
      weeklyEntry(6, { total: [50, 1000] }),
      weeklyEntry(5, { total: [52, 1000] }),
      weeklyEntry(4, { total: [48, 1000] }),
      weeklyEntry(3, { total: [60, 1000] }),
      weeklyEntry(2, { total: [62, 1000] }),
      weeklyEntry(1, { total: [64, 1000] }),
      weeklyEntry(0, { total: [66, 1000] }),
    ];

    const result = playRateMomentum(history, 28);

    // prior window averages (5.0 + 5.0 + 5.2 + 4.8) / 4 = 5.0
    // recent window averages (6.0 + 6.2 + 6.4 + 6.6) / 4 = 6.3
    expect(result?.previous).toBeCloseTo(5.0, 6);
    expect(result?.current).toBeCloseTo(6.3, 6);
    expect(result?.change).toBeCloseTo(1.3, 6);
    expect(result?.relativeChange).toBeCloseTo(0.26, 6);
  });

  it('skips weeks with no snapshot instead of reading them as a drop to zero', () => {
    const history = [
      weeklyEntry(7, { total: [50, 1000] }),
      weeklyEntry(6, { total: [50, 1000] }),
      weeklyEntry(5, { total: [50, 1000] }),
      weeklyEntry(4, { total: [50, 1000] }),
      weeklyEntry(3, { total: [60, 1000] }),
      // no snapshot two weeks ago
      weeklyEntry(1, { total: [60, 1000] }),
      weeklyEntry(0, { total: [60, 1000] }),
    ];

    const result = playRateMomentum(history, 28);

    // Counting the absent week as 0% would average the recent window to 4.5.
    expect(result?.current).toBeCloseTo(6.0, 6);
    expect(result?.change).toBeCloseTo(1.0, 6);
  });

  it('ignores snapshots that recorded no cubes at all', () => {
    const history = [
      weeklyEntry(7, { total: [50, 1000] }),
      weeklyEntry(6, { total: [50, 1000] }),
      weeklyEntry(5, { total: [50, 1000] }),
      weeklyEntry(4, { total: [50, 1000] }),
      weeklyEntry(3, { total: [60, 1000] }),
      weeklyEntry(2, { total: [0, 0] }),
      weeklyEntry(1, { total: [60, 1000] }),
      weeklyEntry(0, { total: [60, 1000] }),
    ];

    const result = playRateMomentum(history, 28);

    // Treating the empty denominator as 0% would average the recent window to 4.5.
    expect(result?.current).toBeCloseTo(6.0, 6);
    expect(result?.change).toBeCloseTo(1.0, 6);
  });

  it('suppresses momentum for cards in too few cubes to be meaningful', () => {
    const history = [
      weeklyEntry(7, { total: [5, 1000] }),
      weeklyEntry(6, { total: [5, 1000] }),
      weeklyEntry(5, { total: [5, 1000] }),
      weeklyEntry(4, { total: [5, 1000] }),
      weeklyEntry(3, { total: [10, 1000] }),
      weeklyEntry(2, { total: [10, 1000] }),
      weeklyEntry(1, { total: [10, 1000] }),
      weeklyEntry(0, { total: [10, 1000] }),
    ];

    expect(playRateMomentum(history, 28)).toBeNull();
    // The cube floor is the only thing withholding it; the data itself is sound.
    expect(playRateMomentum(history, 28, { minCubes: 10 })?.change).toBeCloseTo(0.5, 6);
  });

  it('reports no relative change when the card was in no cubes beforehand', () => {
    const history = [
      weeklyEntry(7, { total: [0, 1000] }),
      weeklyEntry(6, { total: [0, 1000] }),
      weeklyEntry(5, { total: [0, 1000] }),
      weeklyEntry(4, { total: [0, 1000] }),
      weeklyEntry(3, { total: [30, 1000] }),
      weeklyEntry(2, { total: [30, 1000] }),
      weeklyEntry(1, { total: [30, 1000] }),
      weeklyEntry(0, { total: [30, 1000] }),
    ];

    const result = playRateMomentum(history, 28);

    expect(result?.change).toBeCloseTo(3.0, 6);
    expect(result?.relativeChange).toBeNull();
  });

  it('leaves history older than the two windows out of the baseline', () => {
    const history = [
      // A year of low play rates that must not drag the baseline down.
      ...[15, 14, 13, 12, 11, 10, 9, 8].map((weeksAgo) => weeklyEntry(weeksAgo, { total: [10, 1000] })),
      ...[7, 6, 5, 4].map((weeksAgo) => weeklyEntry(weeksAgo, { total: [50, 1000] })),
      ...[3, 2, 1, 0].map((weeksAgo) => weeklyEntry(weeksAgo, { total: [60, 1000] })),
    ];

    const result = playRateMomentum(history, 28);

    expect(result?.previous).toBeCloseTo(5.0, 6);
    expect(result?.change).toBeCloseTo(1.0, 6);
  });

  it('returns null when nothing was recorded in the earlier window', () => {
    const history = [weeklyEntry(3), weeklyEntry(2), weeklyEntry(1), weeklyEntry(0)];

    expect(playRateMomentum(history, 28)).toBeNull();
  });

  it('returns null when a window holds a single snapshot too sparse to average', () => {
    const history = [weeklyEntry(7), weeklyEntry(6), weeklyEntry(5), weeklyEntry(4), weeklyEntry(0)];

    expect(playRateMomentum(history, 28)).toBeNull();
  });
});

describe('eloMomentum', () => {
  it('reports the point swing between trailing windows', () => {
    const history = [
      weeklyEntry(7, { elo: 1200 }),
      weeklyEntry(6, { elo: 1200 }),
      weeklyEntry(5, { elo: 1210 }),
      weeklyEntry(4, { elo: 1190 }),
      weeklyEntry(3, { elo: 1250 }),
      weeklyEntry(2, { elo: 1260 }),
      weeklyEntry(1, { elo: 1270 }),
      weeklyEntry(0, { elo: 1280 }),
    ];

    const result = eloMomentum(history, 28);

    // prior window (1200 + 1200 + 1210 + 1190) / 4 = 1200
    // recent window (1250 + 1260 + 1270 + 1280) / 4 = 1265
    expect(result?.previous).toBeCloseTo(1200, 6);
    expect(result?.current).toBeCloseTo(1265, 6);
    expect(result?.change).toBeCloseTo(65, 6);
  });

  it('ignores snapshots with no recorded elo', () => {
    const history = [
      weeklyEntry(7, { elo: 1200 }),
      weeklyEntry(6, { elo: 1200 }),
      weeklyEntry(5, { elo: 1200 }),
      weeklyEntry(4, { elo: 1200 }),
      weeklyEntry(3, { elo: 1300 }),
      weeklyEntry(2, { elo: undefined }),
      weeklyEntry(1, { elo: 1300 }),
      weeklyEntry(0, { elo: 1300 }),
    ];

    const result = eloMomentum(history, 28);

    // Reading the missing elo as 0 would average the recent window to 975.
    expect(result?.current).toBeCloseTo(1300, 6);
    expect(result?.change).toBeCloseTo(100, 6);
  });

  it('returns null when nothing was recorded in the earlier window', () => {
    const history = [weeklyEntry(3), weeklyEntry(2), weeklyEntry(1), weeklyEntry(0)];

    expect(eloMomentum(history, 28)).toBeNull();
  });
});

describe('playRateSeries', () => {
  it('orders points oldest to newest regardless of how history arrives', () => {
    const history = [weeklyEntry(0, { total: [60, 1000] }), weeklyEntry(2, { total: [40, 1000] })];

    expect(playRateSeries(history)).toEqual([4, 6]);
  });

  it('drops snapshots with no recorded denominator rather than plotting them as zero', () => {
    const history = [
      weeklyEntry(2, { total: [40, 1000] }),
      weeklyEntry(1, { total: [0, 0] }),
      weeklyEntry(0, { total: [60, 1000] }),
    ];

    expect(playRateSeries(history)).toEqual([4, 6]);
  });

  it('is empty for a card with no recorded history', () => {
    expect(playRateSeries([{} as HistoryType])).toEqual([]);
  });
});

describe('eloSeries', () => {
  it('orders points oldest to newest and drops snapshots with no elo', () => {
    const history = [weeklyEntry(0, { elo: 1300 }), weeklyEntry(1, { elo: undefined }), weeklyEntry(2, { elo: 1200 })];

    expect(eloSeries(history)).toEqual([1200, 1300]);
  });
});
