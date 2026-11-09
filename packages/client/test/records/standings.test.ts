import Record, { Match } from '@utils/datatypes/Record';
import { BYE } from '@utils/records/pairings';
import { computeStandings, formatPercentage } from '@utils/records/standings';

const played = (p1: string, p2: string, results: [number, number, number]): Match => ({ p1, p2, results });

const makeRecord = (names: string[], rounds: Match[][], extra: Partial<Record> = {}): Record => ({
  id: 'rec-1',
  cube: 'cube-1',
  date: 0,
  name: 'Friday Draft',
  description: '',
  players: names.map((name) => ({ name })),
  matches: rounds.map((matches) => ({ matches })),
  trophy: [],
  ...extra,
});

describe('computeStandings', () => {
  it('ranks by points, then breaks ties on opponents and games', () => {
    const standings = computeStandings(
      makeRecord(
        ['A', 'B', 'C', 'D'],
        [
          [played('A', 'C', [2, 0, 0]), played('B', 'D', [2, 1, 0])],
          [played('A', 'B', [2, 1, 0]), played('C', 'D', [2, 1, 0])],
        ],
      ),
    );

    expect(standings.map(({ name, rank, points }) => [rank, name, points])).toEqual([
      [1, 'A', 6],
      [2, 'B', 3],
      [3, 'C', 3],
      [4, 'D', 0],
    ]);
    // B and C are both 1-1 against opponents with the same records; B won more of its games.
    const [a, b, c, d] = standings;
    expect(b!.opponentMatchWin).toBeCloseTo(2 / 3);
    expect(c!.opponentMatchWin).toBeCloseTo(2 / 3);
    expect(b!.gameWin).toBeCloseTo(0.5);
    expect(c!.gameWin).toBeCloseTo(0.4);
    expect(a!.gameWin).toBeCloseTo(0.8);
    // D lost every match but counts as a third for its opponents, not zero.
    expect(a!.opponentMatchWin).toBeCloseTo(0.5);
    expect(d!.gameWin).toBeCloseTo(1 / 3);
  });

  it('counts a bye toward the player but leaves it out of opponent percentages', () => {
    const [a, c, b] = computeStandings(
      makeRecord(['A', 'B', 'C'], [[played('A', 'B', [2, 0, 0]), played('C', BYE, [2, 0, 0])]]),
    );

    expect(c).toMatchObject({ name: 'C', wins: 1, points: 3, gameWin: 1 });
    expect(c!.opponentMatchWin).toBeUndefined();
    expect(a!.opponentMatchWin).toBeCloseTo(1 / 3);
    expect(b).toMatchObject({ name: 'B', losses: 1, points: 0 });
  });

  it('does not count a match nobody has reported as a draw', () => {
    const standings = computeStandings(makeRecord(['A', 'B'], [[played('A', 'B', [0, 0, 0])]]));
    expect(standings.map(({ wins, losses, draws, points }) => [wins, losses, draws, points])).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(standings[0]!.gameWin).toBeUndefined();
  });

  it('ranks an overridden record by its own points, without tiebreakers', () => {
    const standings = computeStandings(
      makeRecord(['A', 'B'], [[played('A', 'B', [2, 0, 0])]], { overrides: { B: { wins: 3, losses: 0, draws: 1 } } }),
    );
    expect(standings[0]).toMatchObject({ name: 'B', points: 10, rank: 1 });
    expect(standings[0]!.gameWin).toBeUndefined();
  });

  it('marks dropped players while keeping their standing', () => {
    const standings = computeStandings(makeRecord(['A', 'B'], [[played('A', 'B', [2, 0, 0])]], { dropped: ['A'] }));
    expect(standings[0]).toMatchObject({ name: 'A', rank: 1, dropped: true });
    expect(standings[1]!.dropped).toBe(false);
  });

  it('formats percentages to one decimal', () => {
    expect(formatPercentage(2 / 3)).toBe('66.7%');
    expect(formatPercentage(1)).toBe('100.0%');
    expect(formatPercentage(undefined)).toBe('—');
  });
});
