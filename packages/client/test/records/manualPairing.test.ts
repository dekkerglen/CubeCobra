import { Match } from '@utils/datatypes/Record';

import { giveBye, isPaired, pairTogether, unpair } from '../../src/records/manualPairing';

const round: Match[] = [
  { p1: 'Alice', p2: 'Bob', results: [0, 0, 0] },
  { p1: 'Carol', p2: 'Dave', results: [0, 0, 0] },
];

describe('manual pairing', () => {
  it('pairs two players, leaving their old opponents unpaired', () => {
    const matches = pairTogether(round, 'Alice', 'Carol');
    expect(matches).toEqual([{ p1: 'Alice', p2: 'Carol', results: [0, 0, 0] }]);
    expect(isPaired(matches, 'Bob')).toBe(false);
    expect(isPaired(matches, 'Dave')).toBe(false);
  });

  it('gives a player the bye as a 2-0 win', () => {
    expect(giveBye(round, 'Dave')).toEqual([
      { p1: 'Alice', p2: 'Bob', results: [0, 0, 0] },
      { p1: 'Dave', p2: 'Bye', results: [2, 0, 0] },
    ]);
  });

  it('unpairs a player and their opponent', () => {
    expect(unpair(round, 'Bob')).toEqual([{ p1: 'Carol', p2: 'Dave', results: [0, 0, 0] }]);
  });
});
