import DraftSeat from '@utils/datatypes/DraftSeat';
import { PlayerList } from '@utils/datatypes/Record';
import { setupPicks } from '@utils/draftutil';
import { createPool } from 'serverutils/cube';
import { realignDraftSeats } from 'serverutils/recordSeats';

const seatFor = (label: string, card: number): DraftSeat => ({
  description: `${label} deck`,
  mainboard: [[[card]]],
  sideboard: [[[card + 100]]],
  pickorder: [card],
  owner: `user-${label}`,
  title: label,
});

const playerFor = (label: string): PlayerList[number] => ({ name: label, userId: `user-${label}` });

describe('realignDraftSeats', () => {
  it('returns seats unchanged for an identity seatOrder', () => {
    const seats = [seatFor('Alice', 1), seatFor('Bob', 2), seatFor('Carol', 3)];
    const players = [playerFor('Alice'), playerFor('Bob'), playerFor('Carol')];

    const result = realignDraftSeats(seats, [0, 1, 2], players);

    expect(result).toEqual(seats);
    expect(result).not.toBe(seats);
    expect(seats).toEqual([seatFor('Alice', 1), seatFor('Bob', 2), seatFor('Carol', 3)]);
  });

  it('reorders seats to follow a reordered player list', () => {
    const seats = [seatFor('Alice', 1), seatFor('Bob', 2), seatFor('Carol', 3)];
    const players = [playerFor('Carol'), playerFor('Alice'), playerFor('Bob')];

    const result = realignDraftSeats(seats, [2, 0, 1], players);

    expect(result.map((seat) => seat.mainboard)).toEqual([[[[3]]], [[[1]]], [[[2]]]]);
    expect(result.map((seat) => seat.pickorder)).toEqual([[3], [1], [2]]);
    expect(result.map((seat) => seat.title)).toEqual(['Carol', 'Alice', 'Bob']);
    expect(result.map((seat) => seat.owner)).toEqual(['user-Carol', 'user-Alice', 'user-Bob']);
  });

  it('inserts an empty seat for a new player (-1) without disturbing the others', () => {
    const seats = [seatFor('Alice', 1), seatFor('Bob', 2)];
    const players = [playerFor('Alice'), playerFor('Newcomer'), playerFor('Bob')];

    const result = realignDraftSeats(seats, [0, -1, 1], players);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(seatFor('Alice', 1));
    expect(result[2]).toEqual(seatFor('Bob', 2));
    expect(result[1]).toEqual({
      mainboard: createPool(),
      sideboard: setupPicks(1, 8),
      owner: 'user-Newcomer',
      title: 'Newcomer',
    });
  });

  it('drops the seat of a removed player', () => {
    const seats = [seatFor('Alice', 1), seatFor('Bob', 2), seatFor('Carol', 3)];
    const players = [playerFor('Alice'), playerFor('Carol')];

    const result = realignDraftSeats(seats, [0, 2], players);

    expect(result).toEqual([seatFor('Alice', 1), seatFor('Carol', 3)]);
  });

  it('handles a swap of two players', () => {
    const seats = [seatFor('Alice', 1), seatFor('Bob', 2)];
    const players = [playerFor('Bob'), playerFor('Alice')];

    const result = realignDraftSeats(seats, [1, 0], players);

    expect(result).toEqual([seatFor('Bob', 2), seatFor('Alice', 1)]);
  });

  it('overwrites the owner and title of a reused seat, keeping its deck', () => {
    const seats = [seatFor('Alice', 1)];
    const players: PlayerList = [{ name: 'Renamed', userId: 'user-9' }];

    const result = realignDraftSeats(seats, [0], players);

    expect(result[0]!.title).toBe('Renamed');
    expect(result[0]!.owner).toBe('user-9');
    expect(result[0]!.mainboard).toEqual([[[1]]]);
    expect(result[0]!.sideboard).toEqual([[[101]]]);
    expect(result[0]!.pickorder).toEqual([1]);
    expect(seats[0]).toEqual(seatFor('Alice', 1));
  });

  it('returns a fresh empty seat when the origin index is out of range', () => {
    const result = realignDraftSeats([seatFor('Alice', 1)], [5], [playerFor('Bob')]);

    expect(result).toEqual([
      {
        mainboard: createPool(),
        sideboard: setupPicks(1, 8),
        owner: 'user-Bob',
        title: 'Bob',
      },
    ]);
  });

  it('sets the owner of a new seat from the player userId, and leaves it undefined when unlinked', () => {
    const players: PlayerList = [{ name: 'Linked', userId: 'user-9' }, { name: 'Unlinked' }];

    const result = realignDraftSeats([], [-1, -1], players);

    expect(result[0]!.owner).toBe('user-9');
    expect(result[1]!.owner).toBeUndefined();
    expect(result[1]!.title).toBe('Unlinked');
  });

  it('returns an empty array when every player is removed', () => {
    const seats = [seatFor('Alice', 1), seatFor('Bob', 2)];

    expect(realignDraftSeats(seats, [], [])).toEqual([]);
  });
});
