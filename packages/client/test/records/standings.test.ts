import Record, { Match } from '@utils/datatypes/Record';
import { BYE, UNKNOWN_OPPONENT } from '@utils/records/pairings';
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
    expect(a!.opponentMatchWin).toBeCloseTo(0.5);
    // D won two of its six games: exactly a third, above the 0.33 floor.
    expect(d!.gameWin).toBeCloseTo(1 / 3, 6);
  });

  it('counts a bye toward the player but leaves it out of opponent percentages', () => {
    const [a, c, b] = computeStandings(
      makeRecord(['A', 'B', 'C'], [[played('A', 'B', [2, 0, 0]), played('C', BYE, [2, 0, 0])]]),
    );

    expect(c).toMatchObject({ name: 'C', wins: 1, points: 3, gameWin: 1 });
    expect(c!.opponentMatchWin).toBeUndefined();
    expect(a!.opponentMatchWin).toBeCloseTo(0.33, 4);
    expect(b).toMatchObject({ name: 'B', losses: 1, points: 0 });
  });

  /**
   * MTR Appendix C: "A player's byes are ignored when computing their opponents' match-win and
   * opponents' game-win percentages." Two numbers are needed per player — one including the bye
   * (their own record) and one without it (what they contribute to the people who played them).
   *
   * The case above only shows that the byed player gains no opponent of their own; it cannot
   * catch this, because nobody in its single round ever plays C. This one does: C byes round
   * one, then loses to A in round two, so C's percentages reach A.
   */
  it("ignores a bye when the byed player's percentages feed an opponent", () => {
    const standings = computeStandings(
      makeRecord(
        ['A', 'B', 'C'],
        [
          [played('A', 'B', [2, 0, 0]), played('C', BYE, [2, 0, 0])],
          [played('A', 'C', [2, 0, 0]), played('B', BYE, [2, 0, 0])],
        ],
      ),
    );
    const byName = (name: string) => standings.find((standing) => standing.name === name)!;

    // A played B (0-1 once the bye is set aside) and C (also 0-1): both floor at 0.33.
    // Counting the byes instead would read each of them as 1-1 and give A 0.5.
    expect(byName('A').opponentMatchWin).toBeCloseTo(0.33, 4);
    expect(byName('A').opponentGameWin).toBeCloseTo(0.33, 4);

    // The bye still counts for the player who got it: B and C are each 1-1 with 3 points.
    expect(byName('B')).toMatchObject({ wins: 1, losses: 1, points: 3 });
    expect(byName('C')).toMatchObject({ wins: 1, losses: 1, points: 3 });
    // ...including in their own game-win percentage: 6 bye game points of 12 played.
    expect(byName('C').gameWin).toBeCloseTo(0.5, 4);
  });

  /**
   * A result entered against the placeholder opponent is a match that was really played — a
   * transcribed event often knows a result without knowing who it was against. It used to be
   * discarded whole, so a record transcribed as 2-0 showed 1-0 on this tab.
   */
  it('counts a result recorded against an unknown opponent', () => {
    const standings = computeStandings(
      makeRecord(['A', 'B'], [[played('A', UNKNOWN_OPPONENT, [2, 0, 0])], [played('A', 'B', [2, 1, 0])]]),
    );
    const byName = (name: string) => standings.find((standing) => standing.name === name)!;

    expect(byName('A')).toMatchObject({ wins: 2, losses: 0, points: 6 });
    // Nobody stands behind the placeholder, so it joins no opponent average: A's only
    // countable opponent is B.
    expect(byName('A').opponentMatchWin).toBeCloseTo(0.33, 4);
  });

  it('still ignores an unknown-opponent match nobody has reported', () => {
    const standings = computeStandings(makeRecord(['A', 'B'], [[played('A', UNKNOWN_OPPONENT, [0, 0, 0])]]));

    expect(standings.find((standing) => standing.name === 'A')).toMatchObject({ wins: 0, losses: 0, points: 0 });
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

  it('floors at 0.33, not a third, so an opponent on exactly a third still counts for more', () => {
    const win = (p1: string, p2: string) => played(p1, p2, [2, 0, 0]);
    const standings = computeStandings(
      // Bob is seated first, so only the tiebreaker can put Alice above him.
      makeRecord(
        ['Bob', 'Alice', 'X', 'Y', 'Z1', 'Z2', 'Z3', 'Z4'],
        [
          [win('Alice', 'X'), win('Bob', 'Y')],
          // X goes 1-2 (exactly a third); Y goes 0-3 (nothing, floored to 0.33).
          [win('X', 'Z1'), win('Z3', 'Y')],
          [win('Z2', 'X'), win('Z4', 'Y')],
        ],
      ),
    );
    const alice = standings.find((standing) => standing.name === 'Alice')!;
    const bob = standings.find((standing) => standing.name === 'Bob')!;

    expect(alice.opponentMatchWin).toBeCloseTo(1 / 3, 6);
    expect(bob.opponentMatchWin).toBeCloseTo(0.33, 6);
    expect(alice.rank).toBeLessThan(bob.rank);
  });
});
