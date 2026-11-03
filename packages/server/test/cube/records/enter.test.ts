import { DRAFT_TYPES } from '@utils/datatypes/Draft';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: { getById: jest.fn(), getCards: jest.fn(), update: jest.fn() },
  draftDao: { getById: jest.fn(), update: jest.fn() },
  recordDao: { getById: jest.fn(), update: jest.fn() },
}));

jest.mock('../../../src/router/routes/cube/records/uploaddeck', () => ({
  associateDecksWithNewDraft: jest.fn(),
  associateDecksWithExistingDraft: jest.fn(),
}));

import { cubeDao, draftDao, recordDao } from '../../../src/dynamo/daos';
import { transcribeRecordHandler } from '../../../src/router/routes/cube/records/enter';
import {
  associateDecksWithExistingDraft,
  associateDecksWithNewDraft,
} from '../../../src/router/routes/cube/records/uploaddeck';
import { createCube, createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

describe('transcribeRecordHandler', () => {
  const cube = createCube({ id: 'my-cube' });

  const existingRecord = (overrides: any = {}) => ({
    id: 'rec-1',
    cube: cube.id,
    date: 1,
    name: 'Old name',
    description: 'Old description',
    players: [{ name: 'Alice' }, { name: 'Bob' }],
    matches: [],
    trophy: [],
    dateCreated: 1,
    dateLastUpdated: 1,
    ...overrides,
  });

  // The draft a record points at once decks have been uploaded. The seat pools are
  // marker strings rather than real card grids: nothing under test reads them, but
  // identity makes it visible which original seat a realigned seat came from.
  const uploadDraft = (overrides: any = {}) => ({
    id: 'draft-1',
    cube: cube.id,
    type: DRAFT_TYPES.UPLOAD,
    seats: [
      { title: 'Alice', mainboard: 'alice-pool', sideboard: 'alice-side' },
      { title: 'Bob', mainboard: 'bob-pool', sideboard: 'bob-side' },
    ],
    ...overrides,
  });

  const payload = (overrides: any = {}) => ({
    name: 'Tuesday Cube Night',
    date: 1700000000000,
    description: 'Eight players, three rounds',
    players: [{ name: 'Alice' }, { name: 'Bob' }],
    seatOrder: [0, 1],
    matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] }] }],
    overrides: {},
    trophy: [],
    decks: {},
    ...overrides,
  });

  const save = (body: any, user = cube.owner) =>
    call(transcribeRecordHandler).as(user).withParams({ id: 'rec-1' }).withBody(body).send();

  const savedRecord = () => (recordDao.update as jest.Mock).mock.calls[0][0];

  beforeEach(() => {
    jest.clearAllMocks();
    cube.numDecks = 0;
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (recordDao.getById as jest.Mock).mockResolvedValue(existingRecord());
  });

  it('rejects a user who cannot edit the cube', async () => {
    const res = await save(payload(), createUser());

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: 'false', message: expect.any(String) });
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('rejects a record belonging to another cube', async () => {
    (recordDao.getById as jest.Mock).mockResolvedValue(existingRecord({ cube: 'other-cube' }));

    const res = await save(payload());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: 'false', message: expect.any(String) });
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('applies overview fields, players, matches, overrides and trophy in one recordDao.update', async () => {
    const res = await save(
      payload({
        players: [{ name: 'Alice' }, { name: 'Bob', userId: 'bob-id' }],
        overrides: { Bob: { wins: 3, losses: 0, draws: 1 } },
        trophy: ['Alice'],
      }),
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: 'true' });
    expect(recordDao.update).toHaveBeenCalledTimes(1);
    expect(savedRecord()).toEqual(
      expect.objectContaining({
        name: 'Tuesday Cube Night',
        date: 1700000000000,
        description: 'Eight players, three rounds',
        players: [{ name: 'Alice' }, { name: 'Bob', userId: 'bob-id' }],
        matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] }] }],
        overrides: { Bob: { wins: 3, losses: 0, draws: 1 } },
        trophy: ['Alice'],
      }),
    );
  });

  it('calls associateDecksWithNewDraft once when the record has no draft', async () => {
    const decks = { 1: { mainboard: ['alice-oracle'], sideboard: [] } };

    const res = await save(payload({ decks }));

    expect(res.status).toBe(200);
    expect(associateDecksWithNewDraft).toHaveBeenCalledTimes(1);
    expect(associateDecksWithExistingDraft).not.toHaveBeenCalled();
    // That writer creates the draft, bumps cube.numDecks, sets record.draft and writes the
    // record itself, so the record has to reach it fully applied and must not be written twice.
    expect(recordDao.update).not.toHaveBeenCalled();
    expect(associateDecksWithNewDraft).toHaveBeenCalledWith(
      cube,
      expect.objectContaining({ name: 'Tuesday Cube Night', trophy: [] }),
      decks,
    );
  });

  it('calls associateDecksWithExistingDraft once, with only the submitted seats', async () => {
    const draft = uploadDraft();
    (recordDao.getById as jest.Mock).mockResolvedValue(existingRecord({ draft: draft.id }));
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    const res = await save(payload({ decks: { 2: { mainboard: ['bob-oracle'], sideboard: ['bob-side-oracle'] } } }));

    expect(res.status).toBe(200);
    expect(associateDecksWithNewDraft).not.toHaveBeenCalled();
    expect(associateDecksWithExistingDraft).toHaveBeenCalledTimes(1);
    expect(associateDecksWithExistingDraft).toHaveBeenCalledWith(cube, draft, {
      2: { mainboard: ['bob-oracle'], sideboard: ['bob-side-oracle'] },
    });
    // That writer issues the draft write, so the handler must not issue a second one.
    expect(draftDao.update).not.toHaveBeenCalled();
    expect(recordDao.update).toHaveBeenCalledTimes(1);
  });

  it('does not call applyPlayerRenames: a player swap keeps the submitted pairings verbatim', async () => {
    const res = await save(
      payload({
        // Alice and Bob trade places; the client already keyed everything below by the new names.
        players: [{ name: 'Bob' }, { name: 'Alice' }],
        seatOrder: [1, 0],
        matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] }] }],
        overrides: { Alice: { wins: 2, losses: 1, draws: 0 } },
        trophy: ['Alice'],
      }),
    );

    expect(res.status).toBe(200);
    // A rename pass would map Alice -> Bob and Bob -> Alice and swap all of this straight back.
    expect(savedRecord().matches).toEqual([{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] }] }]);
    expect(savedRecord().overrides).toEqual({ Alice: { wins: 2, losses: 1, draws: 0 } });
    expect(savedRecord().trophy).toEqual(['Alice']);
  });

  it('realigns seats before writing decks when the player order changed', async () => {
    const draft = uploadDraft();
    (recordDao.getById as jest.Mock).mockResolvedValue(existingRecord({ draft: draft.id }));
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    // The deck writer mutates the seats it is handed, so snapshot them at call time:
    // asserting on the draft afterwards cannot tell realign-then-write from write-then-realign.
    let seatsWhenDecksWereWritten: any[] = [];
    (associateDecksWithExistingDraft as jest.Mock).mockImplementation(async (_cube, handedDraft) => {
      seatsWhenDecksWereWritten = handedDraft.seats.map((seat: any) => ({ ...seat }));
    });

    const res = await save(
      payload({
        players: [{ name: 'Bob' }, { name: 'Alice' }],
        seatOrder: [1, 0],
        decks: { 1: { mainboard: ['bob-oracle'], sideboard: [] } },
      }),
    );

    expect(res.status).toBe(200);
    // Seat 1 must already be Bob's old seat, or his submitted deck lands on Alice.
    expect(seatsWhenDecksWereWritten.map((seat) => seat.title)).toEqual(['Bob', 'Alice']);
    expect(seatsWhenDecksWereWritten.map((seat) => seat.mainboard)).toEqual(['bob-pool', 'alice-pool']);
  });

  it('clears a seat submitted with an empty mainboard', async () => {
    const draft = uploadDraft();
    (recordDao.getById as jest.Mock).mockResolvedValue(existingRecord({ draft: draft.id }));
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    const res = await save(payload({ decks: { 1: { mainboard: [], sideboard: [] } } }));

    expect(res.status).toBe(200);
    // An emptied seat is a real edit, not an absent one: the writer resets a seat given an
    // empty mainboard, but only for the seats it is handed.
    expect(associateDecksWithExistingDraft).toHaveBeenCalledWith(cube, draft, {
      1: { mainboard: [], sideboard: [] },
    });
  });

  it('does not hand an empty deck list to the existing-draft writer', async () => {
    const draft = uploadDraft();
    (recordDao.getById as jest.Mock).mockResolvedValue(existingRecord({ draft: draft.id }));
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    const res = await save(payload({ players: [{ name: 'Bob' }, { name: 'Alice' }], seatOrder: [1, 0], decks: {} }));

    expect(res.status).toBe(200);
    expect(associateDecksWithExistingDraft).not.toHaveBeenCalled();
    // The seat realignment still has to be persisted, in exactly one draft write.
    expect(draftDao.update).toHaveBeenCalledTimes(1);
    expect((draftDao.update as jest.Mock).mock.calls[0][0].seats.map((seat: any) => seat.title)).toEqual([
      'Bob',
      'Alice',
    ]);
  });

  it('drops an override keyed to a player not in the submitted list', async () => {
    const res = await save(
      payload({ overrides: { Alice: { wins: 1, losses: 0, draws: 0 }, Ghost: { wins: 9, losses: 0, draws: 0 } } }),
    );

    expect(res.status).toBe(200);
    expect(savedRecord().overrides).toEqual({ Alice: { wins: 1, losses: 0, draws: 0 } });
  });

  it('drops a trophy entry keyed to a player not in the submitted list', async () => {
    const res = await save(payload({ trophy: ['Alice', 'Ghost'] }));

    expect(res.status).toBe(200);
    expect(savedRecord().trophy).toEqual(['Alice']);
  });

  it('accepts a round with no matches', async () => {
    const matches = [{ matches: [] }, { matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 0, 0] }] }];

    const res = await save(payload({ matches }));

    expect(res.status).toBe(200);
    expect(savedRecord().matches).toEqual(matches);
  });

  it('accepts a match with an empty player name', async () => {
    const matches = [{ matches: [{ p1: 'Alice', p2: '', results: [2, 0, 0] }] }];

    const res = await save(payload({ matches }));

    expect(res.status).toBe(200);
    expect(savedRecord().matches).toEqual(matches);
  });

  it('rejects more than 16 players', async () => {
    const players = Array.from({ length: 17 }, (_, index) => ({ name: `Player ${index}` }));

    const res = await save(payload({ players, seatOrder: players.map((_, index) => index) }));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: 'false', message: expect.any(String) });
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('rejects a seatOrder that does not line up with the players', async () => {
    const res = await save(payload({ seatOrder: [0] }));

    expect(res.status).toBe(400);
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('rejects two players sharing a name', async () => {
    // Overrides and trophies are keyed by name, so duplicates make a save ambiguous.
    const res = await save(payload({ players: [{ name: 'Alice' }, { name: 'Alice' }] }));

    expect(res.status).toBe(400);
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('starts a new draft when the record points at one that has been deleted', async () => {
    (recordDao.getById as jest.Mock).mockResolvedValue(existingRecord({ draft: 'gone' }));
    (draftDao.getById as jest.Mock).mockResolvedValue(undefined);

    const res = await save(payload({ decks: { 1: { mainboard: ['alice-oracle'], sideboard: [] } } }));

    expect(res.status).toBe(200);
    expect(associateDecksWithExistingDraft).not.toHaveBeenCalled();
    expect(associateDecksWithNewDraft).toHaveBeenCalledTimes(1);
    expect(draftDao.update).not.toHaveBeenCalled();
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('rejects a mainboard of more than 200 oracle ids', async () => {
    const mainboard = Array.from({ length: 201 }, (_, index) => `oracle-${index}`);

    const res = await save(payload({ decks: { 1: { mainboard, sideboard: [] } } }));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: 'false', message: expect.any(String) });
    expect(associateDecksWithNewDraft).not.toHaveBeenCalled();
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('rejects deck edits when the draft type is not UPLOAD', async () => {
    const draft = uploadDraft({ type: DRAFT_TYPES.DRAFT });
    (recordDao.getById as jest.Mock).mockResolvedValue(existingRecord({ draft: draft.id }));
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    const res = await save(payload({ decks: { 1: { mainboard: ['alice-oracle'], sideboard: [] } } }));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: 'false', message: expect.any(String) });
    // Nothing at all is written: a partial save would leave the mounted page out of step.
    expect(associateDecksWithExistingDraft).not.toHaveBeenCalled();
    expect(draftDao.update).not.toHaveBeenCalled();
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('saves the rest of a record whose draft is not an upload when no decks are submitted', async () => {
    const draft = uploadDraft({ type: DRAFT_TYPES.DRAFT });
    (recordDao.getById as jest.Mock).mockResolvedValue(existingRecord({ draft: draft.id }));
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    const res = await save(payload({ decks: {} }));

    expect(res.status).toBe(200);
    expect(recordDao.update).toHaveBeenCalledTimes(1);
    expect(savedRecord().name).toBe('Tuesday Cube Night');
  });

  it('does not increment cube.numDecks when updating an existing draft', async () => {
    const draft = uploadDraft();
    (recordDao.getById as jest.Mock).mockResolvedValue(existingRecord({ draft: draft.id }));
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    const res = await save(payload({ decks: { 1: { mainboard: ['alice-oracle'], sideboard: [] } } }));

    expect(res.status).toBe(200);
    // Only associateDecksWithNewDraft counts a new deck, and it does the increment itself.
    expect(cube.numDecks).toBe(0);
    expect(cubeDao.update).not.toHaveBeenCalled();
  });
});
