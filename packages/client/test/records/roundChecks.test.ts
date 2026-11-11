import {
  doubleBooked,
  isReservedName,
  isSelfPairing,
  playersWithMatches,
  roundProblems,
  roundProgress,
  tableNumbers,
  unreportedMatches,
} from '@utils/records/roundChecks';

const match = (p1: string, p2: string, results: [number, number, number] = [0, 0, 0]) => ({ p1, p2, results });
const players = ['Alice', 'Bob', 'Carol', 'Dave'].map((name) => ({ name }));

describe('round checks', () => {
  it('treats the pairing placeholders as reserved, in any case', () => {
    expect(isReservedName('bye')).toBe(true);
    expect(isReservedName(' Unknown Opponent ')).toBe(true);
    expect(isReservedName('Byers')).toBe(false);
  });

  it('calls a player against themselves a self-pairing, but not two placeholders', () => {
    expect(isSelfPairing(match('Bob', 'Bob'))).toBe(true);
    expect(isSelfPairing(match('Unknown Opponent', 'Unknown Opponent'))).toBe(false);
  });

  it('finds a player booked into two matches, ignoring placeholders', () => {
    const round = {
      matches: [match('Alice', 'Bob'), match('Bob', 'Carol'), match('Unknown Opponent', 'Unknown Opponent')],
    };
    expect(doubleBooked(round)).toEqual(['Bob']);
  });

  it('lists everything wrong with a round, and nothing with a sound one', () => {
    expect(roundProblems({ matches: [match('Alice', 'Bob'), match('Carol', 'Bye')] }, players)).toEqual([]);
    expect(
      roundProblems({ matches: [match('Bob', 'Bob'), match('Alice', 'Bob'), match('Carol', 'Zed')] }, players),
    ).toEqual([
      'Bob is paired against themselves.',
      'Bob is in more than one match.',
      "Zed isn't a player in this event.",
    ]);
  });

  it('counts only real matches with no result as unreported', () => {
    const round = {
      matches: [match('Alice', 'Bob'), match('Carol', 'Dave', [2, 0, 0]), match('Carol', 'Bye', [0, 0, 0])],
    };
    expect(unreportedMatches(round)).toEqual([match('Alice', 'Bob')]);
  });

  it('knows who has been in a match', () => {
    expect([...playersWithMatches({ matches: [{ matches: [match('Alice', 'Bye'), match('Bob', 'Carol')] }] })]).toEqual(
      ['Alice', 'Bob', 'Carol'],
    );
  });
});

describe('round progress and tables', () => {
  it('counts reported matches between real players only', () => {
    expect(
      roundProgress({
        matches: [match('Alice', 'Bob', [2, 0, 0]), match('Carol', 'Dave'), match('Eve', 'Bye', [2, 0, 0])],
      }),
    ).toEqual({ reported: 1, total: 2 });
  });

  it('numbers the tables, skipping byes and empty matches', () => {
    expect(
      tableNumbers({
        matches: [
          match('Alice', 'Bob'),
          match('Eve', 'Bye'),
          match('Unknown Opponent', 'Unknown Opponent'),
          match('Carol', 'Dave'),
        ],
      }),
    ).toEqual([1, null, null, 2]);
  });
});
