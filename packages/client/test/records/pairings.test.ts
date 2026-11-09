import { Match, Round } from '@utils/datatypes/Record';
import { BYE, generatePairings } from '@utils/records/pairings';

const players = (...names: string[]) => names.map((name) => ({ name }));
const played = (p1: string, p2: string, results: [number, number, number]): Match => ({ p1, p2, results });
const pairs = (matches: Match[]) => matches.map(({ p1, p2 }) => [p1, p2]);

describe('generatePairings', () => {
  it('pairs the first round across the table', () => {
    expect(pairs(generatePairings(players('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'), []))).toEqual([
      ['A', 'E'],
      ['B', 'F'],
      ['C', 'G'],
      ['D', 'H'],
    ]);
  });

  it('gives the middle seat the bye in an odd first round, scored as a win', () => {
    const matches = generatePairings(players('A', 'B', 'C', 'D', 'E'), []);
    expect(pairs(matches)).toEqual([
      ['A', 'D'],
      ['B', 'E'],
      ['C', BYE],
    ]);
    expect(matches[2]!.results).toEqual([2, 0, 0]);
  });

  it('draws round one at random when asked, still giving an odd pod a bye', () => {
    const players = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve'].map((name) => ({ name }));
    // Math.random always 0 shuffles to a fixed, checkable order: Bob, Carol, Dave, Eve, Alice.
    const matches = generatePairings(players, [], [], { method: 'random', random: () => 0 });
    expect(matches).toEqual([
      { p1: 'Carol', p2: 'Dave', results: [0, 0, 0] },
      { p1: 'Eve', p2: 'Alice', results: [0, 0, 0] },
      { p1: 'Bob', p2: 'Bye', results: [2, 0, 0] },
    ]);
  });

  it('draws a later round at random without a rematch or a second bye', () => {
    const players = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve'].map((name) => ({ name }));
    const rounds = [
      {
        matches: [
          { p1: 'Carol', p2: 'Dave', results: [2, 0, 0] as [number, number, number] },
          { p1: 'Eve', p2: 'Alice', results: [2, 1, 0] as [number, number, number] },
          { p1: 'Bob', p2: 'Bye', results: [2, 0, 0] as [number, number, number] },
        ],
      },
    ];
    for (let seed = 0; seed < 20; seed++) {
      let state = seed;
      const random = () => {
        state = (state * 9301 + 49297) % 233280;
        return state / 233280;
      };
      const matches = generatePairings(players, rounds, [], { method: 'random', random });
      const byes = matches.filter((match) => match.p2 === 'Bye');
      expect(byes).toHaveLength(1);
      expect(byes[0]!.p1).not.toBe('Bob');
      const pairs = matches.filter((match) => match.p2 !== 'Bye').map((match) => [match.p1, match.p2].sort().join());
      expect(pairs).not.toContain('Carol,Dave');
      expect(pairs).not.toContain('Alice,Eve');
    }
  });

  it('pairs a later round by record unless told otherwise', () => {
    const players = ['Alice', 'Bob', 'Carol', 'Dave'].map((name) => ({ name }));
    const rounds = [
      {
        matches: [
          { p1: 'Alice', p2: 'Carol', results: [2, 0, 0] as [number, number, number] },
          { p1: 'Bob', p2: 'Dave', results: [2, 0, 0] as [number, number, number] },
        ],
      },
    ];
    expect(generatePairings(players, rounds, [], { method: 'record' })).toEqual(generatePairings(players, rounds));
    expect(generatePairings(players, rounds).map((match) => [match.p1, match.p2])).toEqual([
      ['Alice', 'Bob'],
      ['Carol', 'Dave'],
    ]);
  });

  it('leaves out players who have dropped', () => {
    const rounds: Round[] = [{ matches: [played('A', 'C', [2, 0, 0]), played('B', 'D', [2, 1, 0])] }];
    expect(pairs(generatePairings(players('A', 'B', 'C', 'D'), rounds, ['C']))).toEqual([
      ['A', 'B'],
      ['D', BYE],
    ]);
  });

  it('pairs later rounds by points without repeating a pairing', () => {
    const rounds: Round[] = [
      {
        matches: [played('A', 'C', [2, 0, 0]), played('B', 'D', [2, 1, 0])],
      },
    ];
    // A and B are 1-0 and play each other; C and D are 0-1.
    expect(pairs(generatePairings(players('A', 'B', 'C', 'D'), rounds))).toEqual([
      ['A', 'B'],
      ['C', 'D'],
    ]);
  });

  it('backs up rather than leave the bottom of the standings with a rematch', () => {
    const rounds: Round[] = [
      { matches: [played('A', 'B', [2, 0, 0]), played('C', 'D', [2, 0, 0])] },
      { matches: [played('A', 'C', [2, 0, 0]), played('B', 'D', [2, 0, 0])] },
    ];
    expect(pairs(generatePairings(players('A', 'B', 'C', 'D'), rounds))).toEqual([
      ['A', 'D'],
      ['B', 'C'],
    ]);
  });

  it('treats an unreported match as played but scoreless', () => {
    const rounds: Round[] = [{ matches: [played('A', 'B', [0, 0, 0]), played('C', 'D', [2, 0, 0])] }];
    // C leads alone. A and B already met, so neither is paired with the other again.
    expect(pairs(generatePairings(players('A', 'B', 'C', 'D'), rounds))).toEqual([
      ['C', 'A'],
      ['B', 'D'],
    ]);
  });

  it('gives the bye to the lowest-ranked player who has not had one', () => {
    const rounds: Round[] = [
      { matches: [played('A', 'B', [2, 0, 0]), played('C', 'D', [0, 2, 0]), played('E', BYE, [2, 0, 0])] },
    ];
    // B and C lost; C is lower by seat order, and E already had a bye.
    const matches = generatePairings(players('A', 'B', 'C', 'D', 'E'), rounds);
    expect(matches.at(-1)).toEqual({ p1: 'C', p2: BYE, results: [2, 0, 0] });
    expect(pairs(matches.slice(0, -1)).flat().sort()).toEqual(['A', 'B', 'D', 'E']);
  });

  it('allows rematches once every pairing has happened', () => {
    const rounds: Round[] = [{ matches: [played('A', 'B', [2, 0, 0])] }];
    expect(pairs(generatePairings(players('A', 'B'), rounds))).toEqual([['A', 'B']]);
  });

  it('pairs nobody in a pod too small to pair', () => {
    expect(generatePairings(players('A'), [])).toEqual([]);
  });
});
