import { PlayerList, Round, WinLossDraw } from '@utils/datatypes/Record';
import { rebaseNameKeyedSections } from '@utils/records/rebaseNames';

const match = (p1: string, p2: string): Round => ({
  matches: [{ p1, p2, results: [2, 1, 0] }],
});

describe('rebaseNameKeyedSections', () => {
  it('rewrites a pairing to the stored name when the submission renamed the player', () => {
    const submittedPlayers: PlayerList = [{ id: 'a', name: 'Alicia' }];
    const storedPlayers: PlayerList = [{ id: 'a', name: 'Alice' }];

    const result = rebaseNameKeyedSections(
      { matches: [match('Alicia', 'Unknown Opponent')] },
      submittedPlayers,
      storedPlayers,
    );

    expect(result.matches).toEqual([match('Alice', 'Unknown Opponent')]);
  });

  it('resolves a straight swap of two names against the originals', () => {
    const submittedPlayers: PlayerList = [
      { id: 'a', name: 'Bob' },
      { id: 'b', name: 'Alice' },
    ];
    const storedPlayers: PlayerList = [
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ];

    const result = rebaseNameKeyedSections({ matches: [match('Bob', 'Alice')] }, submittedPlayers, storedPlayers);

    // Must resolve against the originals, not chain Bob -> Alice -> Bob.
    expect(result.matches).toEqual([match('Alice', 'Bob')]);
  });

  it('leaves Unknown Opponent untouched', () => {
    const submittedPlayers: PlayerList = [{ id: 'a', name: 'Alicia' }];
    const storedPlayers: PlayerList = [{ id: 'a', name: 'Alice' }];

    const result = rebaseNameKeyedSections(
      { matches: [match('Unknown Opponent', 'Unknown Opponent')] },
      submittedPlayers,
      storedPlayers,
    );

    expect(result.matches).toEqual([match('Unknown Opponent', 'Unknown Opponent')]);
  });

  it('leaves a name with no id match untouched', () => {
    // Old record: nobody has an id, so there is nothing to rebase against.
    const submittedPlayers: PlayerList = [{ name: 'Alice' }, { name: 'Bob' }];
    const storedPlayers: PlayerList = [{ name: 'Alice' }, { name: 'Bob' }];

    const submitted = {
      matches: [match('Alice', 'Bob')],
      trophy: ['Alice'],
      overrides: { Bob: { wins: 1, losses: 0, draws: 0 } },
    };
    const result = rebaseNameKeyedSections(submitted, submittedPlayers, storedPlayers);

    expect(result).toEqual(submitted);
  });

  it('rebases trophy entries and override keys as well as pairings', () => {
    const submittedPlayers: PlayerList = [{ id: 'a', name: 'Alicia' }];
    const storedPlayers: PlayerList = [{ id: 'a', name: 'Alice' }];
    const overrides: { [name: string]: WinLossDraw } = { Alicia: { wins: 2, losses: 1, draws: 0 } };

    const result = rebaseNameKeyedSections({ trophy: ['Alicia'], overrides }, submittedPlayers, storedPlayers);

    expect(result.trophy).toEqual(['Alice']);
    expect(result.overrides).toEqual({ Alice: { wins: 2, losses: 1, draws: 0 } });
  });

  it('leaves an absent section absent rather than materialising an empty one', () => {
    const submittedPlayers: PlayerList = [{ id: 'a', name: 'Alicia' }];
    const storedPlayers: PlayerList = [{ id: 'a', name: 'Alice' }];

    const result = rebaseNameKeyedSections({ trophy: ['Alicia'] }, submittedPlayers, storedPlayers);

    expect(result.matches).toBeUndefined();
    expect(result.overrides).toBeUndefined();
  });

  it('is a no-op when neither player list has any ids', () => {
    const submittedPlayers: PlayerList = [{ name: 'Alicia' }];
    const storedPlayers: PlayerList = [{ name: 'Alice' }];

    const submitted = { matches: [match('Alicia', 'Unknown Opponent')] };
    const result = rebaseNameKeyedSections(submitted, submittedPlayers, storedPlayers);

    // Assert identity (same reference), not just value equality, to confirm the early return
    // at rebaseNames.ts:44 is triggered and the input object is returned unchanged.
    expect(result).toBe(submitted);
    expect(result.matches).toEqual([match('Alicia', 'Unknown Opponent')]);
  });
});
