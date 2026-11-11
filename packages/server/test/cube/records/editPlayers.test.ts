import { DRAFT_TYPES } from '@utils/datatypes/Draft';

import { editRecordPlayersHandler } from '../../../src/router/routes/cube/records/edit/players';
import { createCube } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('serverutils/render', () => ({
  ...jest.requireActual('serverutils/render'),
  redirect: jest.fn(),
}));

import { redirect } from 'serverutils/render';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: { getById: jest.fn() },
  draftDao: { getById: jest.fn(), update: jest.fn() },
  recordDao: { getById: jest.fn(), update: jest.fn() },
}));

import { cubeDao, draftDao, recordDao } from '../../../src/dynamo/daos';

// A played draft's seats carry history: a deck name its owner typed, the real drafter,
// and pick orders that reference an InitialState tied to the seats by position.
const playedSeat = (title: string, owner: string) => ({
  title,
  owner,
  mainboard: [[[1]]],
  sideboard: [[[2]]],
  pickorder: [1, 2, 3],
});

describe('editRecordPlayersHandler', () => {
  const cube = createCube({ id: 'my-cube' });
  const flash = jest.fn();

  const record = (draftId?: string) => ({
    id: 'rec-1',
    cube: cube.id,
    players: [{ name: 'Alice', userId: 'user-alice' }, { name: 'Bob' }],
    matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] }] }],
    trophy: ['Alice'],
    overrides: { Alice: { wins: 3, losses: 0, draws: 0 } },
    draft: draftId,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
  });

  const editPlayers = (players: unknown, seatOrder: unknown) =>
    call(editRecordPlayersHandler)
      .as(cube.owner)
      .withFlash(flash)
      .withParams({ id: 'rec-1' })
      .withBody({ players: JSON.stringify(players), seatOrder: JSON.stringify(seatOrder) })
      .send();

  describe('against a played draft', () => {
    const seats = [playedSeat('Jeskai Control', 'user-alice'), playedSeat('Rakdos Sacrifice', 'user-bob')];

    beforeEach(() => {
      (recordDao.getById as jest.Mock).mockResolvedValue(record('draft-1'));
      (draftDao.getById as jest.Mock).mockResolvedValue({ id: 'draft-1', type: DRAFT_TYPES.DRAFT, seats });
    });

    it('leaves the draft untouched when nothing changed', async () => {
      await editPlayers([{ name: 'Alice', userId: 'user-alice' }, { name: 'Bob' }], [0, 1]);

      expect(draftDao.update).not.toHaveBeenCalled();
      expect(recordDao.update).toHaveBeenCalledTimes(1);
    });

    it('renames a player without rewriting the seats', async () => {
      await editPlayers([{ name: 'Alice', userId: 'user-alice' }, { name: 'Robert' }], [0, 1]);

      expect(draftDao.update).not.toHaveBeenCalled();
      const saved = (recordDao.update as jest.Mock).mock.calls[0][0];
      expect(saved.players[1].name).toBe('Robert');
      expect(saved.matches[0].matches[0].p2).toBe('Robert');
    });

    it('preserves the seat titles that name the draft and its decks', async () => {
      const draft = { id: 'draft-1', type: DRAFT_TYPES.DRAFT, seats };
      (draftDao.getById as jest.Mock).mockResolvedValue(draft);

      await editPlayers([{ name: 'Alice', userId: 'user-alice' }, { name: 'Robert' }], [0, 1]);

      expect(draft.seats.map((seat) => seat.title)).toEqual(['Jeskai Control', 'Rakdos Sacrifice']);
      expect(recordDao.update).toHaveBeenCalledTimes(1);
    });

    it('preserves the real drafter on each seat', async () => {
      const draft = { id: 'draft-1', type: DRAFT_TYPES.DRAFT, seats };
      (draftDao.getById as jest.Mock).mockResolvedValue(draft);

      await editPlayers([{ name: 'Alice' }, { name: 'Bob' }], [0, 1]);

      expect(draft.seats.map((seat) => seat.owner)).toEqual(['user-alice', 'user-bob']);
      expect(recordDao.update).toHaveBeenCalledTimes(1);
    });

    it('refuses a reorder and writes nothing', async () => {
      await editPlayers([{ name: 'Bob' }, { name: 'Alice', userId: 'user-alice' }], [1, 0]);

      expect(flash).toHaveBeenCalledWith('danger', expect.stringMatching(/played draft/i));
      expect(draftDao.update).not.toHaveBeenCalled();
      expect(recordDao.update).not.toHaveBeenCalled();
    });

    it('refuses an added player and writes nothing', async () => {
      await editPlayers([{ name: 'Alice', userId: 'user-alice' }, { name: 'Bob' }, { name: 'Carol' }], [0, 1, -1]);

      expect(flash).toHaveBeenCalledWith('danger', expect.stringMatching(/played draft/i));
      expect(draftDao.update).not.toHaveBeenCalled();
      expect(recordDao.update).not.toHaveBeenCalled();
    });

    it('refuses a permuted player list that claims an identity seat order', async () => {
      // seatOrder is client-supplied and defaults to identity when absent, so the gate
      // cannot take it at its word: the submitted players must still describe the seats
      // they claim to occupy, or the record would be saved permuted against fixed seats.
      await call(editRecordPlayersHandler)
        .as(cube.owner)
        .withFlash(flash)
        .withParams({ id: 'rec-1' })
        .withBody({ players: JSON.stringify([{ name: 'Bob' }, { name: 'Alice', userId: 'user-alice' }]) })
        .send();

      expect(flash).toHaveBeenCalledWith('danger', expect.stringMatching(/played draft/i));
      expect(draftDao.update).not.toHaveBeenCalled();
      expect(recordDao.update).not.toHaveBeenCalled();
    });

    it('allows unlinking a player from their account, which moves no seat', async () => {
      await editPlayers([{ name: 'Alice' }, { name: 'Bob' }], [0, 1]);

      expect(draftDao.update).not.toHaveBeenCalled();
      expect(recordDao.update).toHaveBeenCalledTimes(1);
    });

    it('allows linking a previously unlinked player to an account', async () => {
      await editPlayers(
        [
          { name: 'Alice', userId: 'user-alice' },
          { name: 'Bob', userId: 'user-bob' },
        ],
        [0, 1],
      );

      expect(draftDao.update).not.toHaveBeenCalled();
      expect(recordDao.update).toHaveBeenCalledTimes(1);
    });

    it('allows a rename submitted without a seat order', async () => {
      await call(editRecordPlayersHandler)
        .as(cube.owner)
        .withFlash(flash)
        .withParams({ id: 'rec-1' })
        .withBody({ players: JSON.stringify([{ name: 'Alice', userId: 'user-alice' }, { name: 'Robert' }]) })
        .send();

      expect(draftDao.update).not.toHaveBeenCalled();
      expect(recordDao.update).toHaveBeenCalledTimes(1);
    });

    it('refuses a removed player and writes nothing', async () => {
      // No matches, so it's the draft refusing the removal, not the matches.
      (recordDao.getById as jest.Mock).mockResolvedValue({ ...record('draft-1'), matches: [] });
      await editPlayers([{ name: 'Alice', userId: 'user-alice' }], [0]);

      expect(flash).toHaveBeenCalledWith('danger', expect.stringMatching(/played draft/i));
      expect(draftDao.update).not.toHaveBeenCalled();
      expect(recordDao.update).not.toHaveBeenCalled();
    });
  });

  describe('against an upload draft', () => {
    beforeEach(() => {
      (recordDao.getById as jest.Mock).mockResolvedValue(record('draft-1'));
      (draftDao.getById as jest.Mock).mockResolvedValue({
        id: 'draft-1',
        type: DRAFT_TYPES.UPLOAD,
        seats: [playedSeat('Alice', 'user-alice'), playedSeat('Bob', 'user-bob')],
      });
    });

    it('still realigns seats on a reorder, carrying each deck with its player', async () => {
      await editPlayers([{ name: 'Bob' }, { name: 'Alice', userId: 'user-alice' }], [1, 0]);

      expect(draftDao.update).toHaveBeenCalledTimes(1);
      const saved = (draftDao.update as jest.Mock).mock.calls[0][0];
      expect(saved.seats.map((seat: { title: string }) => seat.title)).toEqual(['Bob', 'Alice']);
      expect(recordDao.update).toHaveBeenCalledTimes(1);
    });

    it('propagates a rename to the seat title, which is the player name by convention', async () => {
      await editPlayers([{ name: 'Alice', userId: 'user-alice' }, { name: 'Robert' }], [0, 1]);

      const saved = (draftDao.update as jest.Mock).mock.calls[0][0];
      expect(saved.seats[1].title).toBe('Robert');
    });

    it('leaves every existing seat deck where it was when appending new players', async () => {
      // The Players tab's "Add Players" always submits identity-for-existing, -1-for-new — this
      // asserts the server honors that rather than, say, treating the longer list as a reorder.
      await editPlayers(
        [
          { name: 'Alice', userId: 'user-alice' },
          { name: 'Bob', userId: 'user-bob' },
          { name: 'Carol' },
          { name: 'Dave' },
        ],
        [0, 1, -1, -1],
      );

      expect(draftDao.update).toHaveBeenCalledTimes(1);
      const saved = (draftDao.update as jest.Mock).mock.calls[0][0];
      expect(saved.seats).toHaveLength(4);
      // Seats 0 and 1 keep the exact deck data they had — appending must not reshuffle or
      // blank anyone already seated.
      expect(saved.seats[0]).toMatchObject({
        title: 'Alice',
        owner: 'user-alice',
        mainboard: [[[1]]],
        pickorder: [1, 2, 3],
      });
      expect(saved.seats[1]).toMatchObject({
        title: 'Bob',
        owner: 'user-bob',
        mainboard: [[[1]]],
        pickorder: [1, 2, 3],
      });
      // The two appended players get fresh, empty seats rather than inheriting anyone's deck.
      expect(saved.seats[2]).not.toHaveProperty('pickorder');
      expect(saved.seats[3]).not.toHaveProperty('pickorder');
      expect(saved.seats[2].title).toBe('Carol');
      expect(saved.seats[3].title).toBe('Dave');
      expect(recordDao.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('with no draft', () => {
    beforeEach(() => {
      (recordDao.getById as jest.Mock).mockResolvedValue(record(undefined));
    });

    it('saves the players without looking for a draft', async () => {
      await editPlayers([{ name: 'Alice', userId: 'user-alice' }, { name: 'Robert' }], [0, 1]);

      expect(draftDao.getById).not.toHaveBeenCalled();
      expect(recordDao.update).toHaveBeenCalledTimes(1);
    });

    it('redirects to the Players tab after a successful save', async () => {
      await editPlayers([{ name: 'Alice', userId: 'user-alice' }, { name: 'Robert' }], [0, 1]);

      // Players was the combined tab's "By Player" view before the split, and this is the
      // player an owner most likely just acted on — not the Full Draft grid.
      expect(redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/cube/record/rec-1?tab=players');
    });
  });

  describe('with round one paired at the table', () => {
    const unpaired = () => ({ ...record(undefined), matches: [], trophy: [], overrides: {} });
    const seatAndPair = (players: unknown, firstRound: unknown, seatOrder?: number[]) =>
      call(editRecordPlayersHandler)
        .as(cube.owner)
        .withFlash(flash)
        .withParams({ id: 'rec-1' })
        .withBody({
          players: JSON.stringify(players),
          seatOrder: JSON.stringify(seatOrder ?? (players as unknown[]).map(() => -1)),
          firstRound: JSON.stringify(firstRound),
        })
        .send();
    const trio = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }];

    beforeEach(() => {
      (recordDao.getById as jest.Mock).mockResolvedValue(unpaired());
    });

    it('saves the seating and round one together, bye included, and opens the Matches tab', async () => {
      const round = {
        matches: [
          { p1: 'Alice', p2: 'Carol', results: [0, 0, 0] },
          { p1: 'Bob', p2: 'Bye', results: [2, 0, 0] },
        ],
      };
      await seatAndPair(trio, round);

      const saved = (recordDao.update as jest.Mock).mock.calls[0][0];
      expect(saved.players.map((player: { name: string }) => player.name)).toEqual(['Alice', 'Bob', 'Carol']);
      expect(saved.matches).toEqual([round]);
      expect(redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/cube/record/rec-1?tab=matches');
    });

    it('refuses a round that names someone not at the table, and writes nothing', async () => {
      await seatAndPair(trio, { matches: [{ p1: 'Alice', p2: 'Zed', results: [0, 0, 0] }] });

      expect(recordDao.update).not.toHaveBeenCalled();
      expect(flash).toHaveBeenCalledWith('danger', expect.stringContaining('did not match'));
    });

    it('refuses a round that pairs a player twice', async () => {
      await seatAndPair(trio, {
        matches: [
          { p1: 'Alice', p2: 'Bob', results: [0, 0, 0] },
          { p1: 'Alice', p2: 'Carol', results: [0, 0, 0] },
        ],
      });

      expect(recordDao.update).not.toHaveBeenCalled();
    });

    it('will not pair round one again on a record that already has a round', async () => {
      (recordDao.getById as jest.Mock).mockResolvedValue(record(undefined));
      await seatAndPair(
        [{ name: 'Alice', userId: 'user-alice' }, { name: 'Bob' }],
        { matches: [{ p1: 'Alice', p2: 'Bob', results: [0, 0, 0] }] },
        [0, 1],
      );

      expect(recordDao.update).not.toHaveBeenCalled();
      expect(flash).toHaveBeenCalledWith('danger', expect.stringContaining('already has a round'));
    });
  });

  describe('mid-event', () => {
    beforeEach(() => {
      (recordDao.getById as jest.Mock).mockResolvedValue(record(undefined));
    });
    const send = (body: object) =>
      call(editRecordPlayersHandler).as(cube.owner).withFlash(flash).withParams({ id: 'rec-1' }).withBody(body).send();

    it('refuses to remove a player who has matches, pointing to Drop instead', async () => {
      await editPlayers([{ name: 'Alice', userId: 'user-alice' }], [0]);

      expect(recordDao.update).not.toHaveBeenCalled();
      expect(flash).toHaveBeenCalledWith('danger', expect.stringContaining('Bob already has matches'));
    });

    it('still lets a player with no matches be removed', async () => {
      (recordDao.getById as jest.Mock).mockResolvedValue({
        ...record(undefined),
        players: [{ name: 'Alice', userId: 'user-alice' }, { name: 'Bob' }, { name: 'Carol' }],
      });
      await editPlayers([{ name: 'Alice', userId: 'user-alice' }, { name: 'Bob' }], [0, 1]);

      expect(recordDao.update).toHaveBeenCalledTimes(1);
    });

    it('refuses a save built from a roster that has changed since', async () => {
      await send({
        players: JSON.stringify([{ name: 'Bob' }, { name: 'Alice', userId: 'user-alice' }]),
        seatOrder: JSON.stringify([1, 0]),
        // The form saw Alice and Robert; the stored list is Alice and Bob.
        expectedPlayers: JSON.stringify(['Alice', 'Robert']),
      });

      expect(recordDao.update).not.toHaveBeenCalled();
      expect(flash).toHaveBeenCalledWith('danger', expect.stringContaining('changed somewhere else'));
    });

    it('saves when the roster is the one the form was built from', async () => {
      await send({
        players: JSON.stringify([{ name: 'Bob' }, { name: 'Alice', userId: 'user-alice' }]),
        seatOrder: JSON.stringify([1, 0]),
        expectedPlayers: JSON.stringify(['Alice', 'Bob']),
      });

      expect(recordDao.update).toHaveBeenCalledTimes(1);
    });

    it('refuses a player named for a pairing placeholder', async () => {
      await editPlayers([{ name: 'Alice', userId: 'user-alice' }, { name: 'bye' }], [0, 1]);

      expect(recordDao.update).not.toHaveBeenCalled();
      expect(flash).toHaveBeenCalledWith('danger', expect.stringContaining("can't be a player's name"));
    });
  });
});
