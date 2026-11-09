import {
  parsePlayerList,
  resizeTable,
  roundOneOpponent,
  roundOnePairings,
  Seat,
  seatPlayers,
  seatsFromPlayers,
  setSeat,
  shuffleSeats,
  swapSeats,
  tableSubmission,
} from '../../src/records/seating';

const names = (seats: Seat[]) => seats.map((seat) => seat.player?.name ?? null);
// A fixed sequence standing in for Math.random, so a shuffle is repeatable.
const sequence = (...values: number[]) => {
  let index = 0;
  return () => values[index++ % values.length]!;
};

describe('seating', () => {
  it('opens an eight-chair table with the record players in their seats', () => {
    const seats = seatsFromPlayers([{ name: 'Alice', id: 'a' }, { name: 'Bob' }]);
    expect(names(seats)).toEqual(['Alice', 'Bob', null, null, null, null, null, null]);
    expect(seats.map((seat) => seat.origin)).toEqual([0, 1, -1, -1, -1, -1, -1, -1]);
  });

  it('names the round-one opponent across the table, with empty chairs closed up', () => {
    // Five players at an eight-chair table pair as a pod of five: seat 1 meets seat 4.
    const seats = seatsFromPlayers(['A', 'B', 'C', 'D', 'E'].map((name) => ({ name })));
    const across = (table: Seat[]) => roundOnePairings(table, 'across');
    expect(roundOneOpponent(seats, 0, across(seats))).toBe(3);
    expect(roundOneOpponent(seats, 3, across(seats))).toBe(0);
    expect(roundOneOpponent(seats, 2, across(seats))).toBe('bye');
    expect(roundOneOpponent(seats, 6, across(seats))).toBeNull();

    // A gap in the middle of the table does not change who meets whom.
    const gapped = swapSeats(seats, 4, 5);
    expect(roundOneOpponent(gapped, 0, across(gapped))).toBe(3);
  });

  it('draws random round-one pairings that hold still for a seed and give an odd pod one bye', () => {
    const seats = seatsFromPlayers(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((name) => ({ name })));
    const draw = roundOnePairings(seats, 'random', 42);
    expect(roundOnePairings(seats, 'random', 42)).toEqual(draw);

    expect(draw).toHaveLength(4);
    expect(draw.filter((match) => match.p2 === 'Bye')).toHaveLength(1);
    const paired = draw.flatMap((match) => [match.p1, match.p2]).filter((name) => name !== 'Bye');
    expect([...paired].sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);

    // Some other seed draws differently.
    const seeds = Array.from({ length: 10 }, (_, seed) => JSON.stringify(roundOnePairings(seats, 'random', seed)));
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it('renames whoever sits in a chair, keeping their place in the record', () => {
    const seats = setSeat(seatsFromPlayers([{ name: 'Alice', id: 'a' }]), 0, { name: 'Alicia' });
    expect(seats[0]).toEqual({ player: { id: 'a', name: 'Alicia' }, origin: 0 });
  });

  it('seats a newcomer in an empty chair and empties a cleared one', () => {
    let seats = setSeat(seatsFromPlayers([{ name: 'Alice' }]), 3, { name: 'Bob' });
    expect(seats[3]).toEqual({ player: { name: 'Bob' }, origin: -1 });
    seats = setSeat(seats, 0, undefined);
    expect(seats[0]).toEqual({ origin: -1 });
  });

  it('swaps two chairs, players and origins together', () => {
    const seats = swapSeats(seatsFromPlayers([{ name: 'Alice' }, { name: 'Bob' }]), 0, 5);
    expect(names(seats).slice(0, 6)).toEqual([null, 'Bob', null, null, null, 'Alice']);
    expect(seats[5]!.origin).toBe(0);
  });

  it('shrinks the table by its empty chairs only', () => {
    const seats = swapSeats(seatsFromPlayers([{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }]), 2, 7);
    expect(names(resizeTable(seats, 4))).toEqual(['Alice', 'Bob', null, 'Carol']);
    expect(resizeTable(seats, 2)).toHaveLength(3);
    expect(resizeTable(seats, 40)).toHaveLength(16);
  });

  it('shuffles the players into the first chairs', () => {
    const seats = shuffleSeats(
      seatsFromPlayers([{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }]),
      sequence(0, 0),
    );
    expect(names(seats)).toEqual(['Bob', 'Carol', 'Alice', null, null, null, null, null]);
  });

  it('reads a pasted list, skipping blanks and repeats', () => {
    expect(parsePlayerList('Alice\n\n bob \n@Carol, Dave\nBOB\ncarol')).toEqual({
      names: ['Alice', 'bob', '@Carol', 'Dave'],
      duplicates: ['BOB', 'carol'],
    });
  });

  it('seats a list one chair each, keeping players already at the table', () => {
    const current = seatsFromPlayers([{ name: 'Alice', id: 'a', userId: 'u-a' }, { name: 'Bob' }]);
    const seats = seatPlayers([{ name: 'Carol' }, { name: 'alice' }], current, 'listed');
    expect(seats).toEqual([
      { player: { name: 'Carol' }, origin: -1 },
      { player: { name: 'alice', id: 'a', userId: 'u-a' }, origin: 0 },
    ]);
  });

  it('seats a list at random when asked', () => {
    const seats = seatPlayers([{ name: 'A' }, { name: 'B' }, { name: 'C' }], [], 'random', sequence(0, 0));
    expect(names(seats)).toEqual(['B', 'C', 'A']);
  });

  it('closes up the empty chairs for the players endpoint', () => {
    const seats = swapSeats(seatsFromPlayers([{ name: 'Alice' }, { name: 'Bob' }]), 0, 3);
    expect(tableSubmission(setSeat(seats, 6, { name: 'Carol' }))).toEqual({
      players: [{ name: 'Bob' }, { name: 'Alice' }, { name: 'Carol' }],
      seatOrder: [1, 0, -1],
    });
  });
});
