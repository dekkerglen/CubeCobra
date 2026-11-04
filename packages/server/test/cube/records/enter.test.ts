import { DRAFT_TYPES } from '@utils/datatypes/Draft';
import { setupPicks } from '@utils/draftutil';
import { deckProjection } from '@utils/records/recordSections';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: { getById: jest.fn(), getCards: jest.fn(), update: jest.fn() },
  draftDao: { getById: jest.fn(), update: jest.fn() },
  recordDao: { getById: jest.fn(), update: jest.fn() },
  userDao: { batchGet: jest.fn() },
}));

jest.mock('serverutils/render', () => ({
  ...jest.requireActual('serverutils/render'),
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
  render: jest.fn(),
}));

jest.mock('../../../src/router/routes/cube/records/uploaddeck', () => ({
  associateDecksWithNewDraft: jest.fn(),
  associateDecksWithExistingDraft: jest.fn(),
}));

import { cubeDao, draftDao, recordDao, userDao } from '../../../src/dynamo/daos';
import { transcribeRecordHandler, transcribeRecordPageHandler } from '../../../src/router/routes/cube/records/enter';
import {
  associateDecksWithExistingDraft,
  associateDecksWithNewDraft,
} from '../../../src/router/routes/cube/records/uploaddeck';
import { redirect, render } from '../../../src/serverutils/render';
import { createCard, createCardDetails, createCube, createUser } from '../../test-utils/data';
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

  // A pool holding exactly the oracle ids at `cardIndexes` into `draft.cards`, in one slot —
  // only the ordered flattened content is under test, not row/column placement.
  const pool = (rows: number, cardIndexes: number[] = []): number[][][] => {
    const grid = setupPicks(rows, 8);
    if (cardIndexes.length > 0) {
      grid[0]![0] = cardIndexes;
    }
    return grid;
  };

  // The draft a record points at once decks have been uploaded. Real seat pools (rather than
  // the old marker strings) so `deckProjection` — which the test payload builder below calls
  // to derive a matching baseline — has real content to flatten.
  const uploadDraft = (overrides: any = {}) => {
    const alicePool = pool(2, [0]);
    const aliceSideboard = pool(1);
    const bobPool = pool(2, [1]);
    const bobSideboard = pool(1, [2]);
    const draft = {
      id: 'draft-1',
      cube: cube.id,
      type: DRAFT_TYPES.UPLOAD,
      cards: [
        createCard({ details: createCardDetails({ oracle_id: 'alice-oracle' }) }),
        createCard({ details: createCardDetails({ oracle_id: 'bob-oracle' }) }),
        createCard({ details: createCardDetails({ oracle_id: 'bob-side-oracle' }) }),
      ],
      seats: [
        { title: 'Alice', mainboard: alicePool, sideboard: aliceSideboard },
        { title: 'Bob', mainboard: bobPool, sideboard: bobSideboard },
      ],
      ...overrides,
    };
    return { draft, alicePool, bobPool };
  };

  // Builds a request body in the sections/baselines shape the endpoint now accepts, from the
  // same "one flat event" inputs this suite always described. Every section's baseline is
  // derived from `stored` (what recordDao.getById will return), so unless a test deliberately
  // diverges, every section matches what is stored and lands in one save — the old
  // "everything always lands" behaviour this suite exercises, now routed through the
  // conflict-aware endpoint. Conflict detection itself is enterConflicts.test.ts's job.
  const fullPayload = (
    input: {
      name?: string;
      date?: number;
      description?: string;
      players?: { name: string; userId?: string; id?: string }[];
      seatOrder?: number[];
      matches?: any[];
      overrides?: { [name: string]: { wins: number; losses: number; draws: number } };
      trophy?: string[];
      // 1-based, matching this suite's existing convention and associateDecksWith*'s own.
      decks?: { [oneBasedIndex: number]: { mainboard: string[]; sideboard: string[] } };
    } = {},
    stored: any = existingRecord(),
    draft?: any,
  ) => {
    const players = input.players ?? [{ name: 'Alice' }, { name: 'Bob' }];
    const seatOrder = input.seatOrder ?? players.map((_, index) => index);
    const sections: any = {
      overview: {
        name: input.name ?? 'Tuesday Cube Night',
        date: input.date ?? 1700000000000,
        description: input.description ?? 'Eight players, three rounds',
      },
      players: { players, seatOrder },
      rounds: { matches: input.matches ?? [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] }] }] },
      trophy: { trophy: input.trophy ?? [] },
    };
    const baselines: any = {
      overview: { name: stored.name, date: stored.date, description: stored.description },
      players: { players: stored.players, seatOrder: stored.players.map((_: any, index: number) => index) },
      rounds: { matches: stored.matches },
      trophy: { trophy: stored.trophy },
    };

    for (const [playerName, value] of Object.entries(input.overrides ?? {})) {
      const index = players.findIndex((player) => player.name === playerName);
      sections[`overrides:${index}`] = value;
      baselines.overrides = { ...baselines.overrides, [index]: stored.overrides?.[playerName] ?? null };
    }

    for (const [oneBasedIndex, deck] of Object.entries(input.decks ?? {})) {
      const index = Number(oneBasedIndex) - 1;
      sections[`decks:${index}`] = deck;
      const origin = seatOrder[index] ?? -1;
      const seat = origin >= 0 ? draft?.seats[origin] : undefined;
      baselines.decks = { ...baselines.decks, [index]: deckProjection(seat, draft?.cards ?? []) };
    }

    return { sections, baselines };
  };

  const save = (body: any, user = cube.owner) =>
    call(transcribeRecordHandler).as(user).withParams({ id: 'rec-1' }).withBody(body).send();

  const savedRecord = () => (recordDao.update as jest.Mock).mock.calls[0][0];

  // Tolerates the id reconciliation now stamps onto every player, which these pre-existing
  // assertions never cared about.
  const matchPlayers = (players: { name: string; userId?: string }[]) =>
    players.map((player) => expect.objectContaining(player));

  beforeEach(() => {
    jest.clearAllMocks();
    cube.numDecks = 0;
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [], maybeboard: [] });
    (recordDao.getById as jest.Mock).mockResolvedValue(existingRecord());
    (draftDao.getById as jest.Mock).mockResolvedValue(undefined);
  });

  it('rejects a user who cannot edit the cube', async () => {
    const res = await save(fullPayload(), createUser());

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: 'false', message: expect.any(String) });
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('rejects a record belonging to another cube', async () => {
    (recordDao.getById as jest.Mock).mockResolvedValue(existingRecord({ cube: 'other-cube' }));

    const res = await save(fullPayload());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: 'false', message: expect.any(String) });
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('applies overview fields, players, matches, overrides and trophy in one recordDao.update', async () => {
    const res = await save(
      fullPayload({
        players: [{ name: 'Alice' }, { name: 'Bob', userId: 'bob-id' }],
        overrides: { Bob: { wins: 3, losses: 0, draws: 1 } },
        trophy: ['Alice'],
      }),
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe('true');
    expect(recordDao.update).toHaveBeenCalledTimes(1);
    expect(savedRecord()).toEqual(
      expect.objectContaining({
        name: 'Tuesday Cube Night',
        date: 1700000000000,
        description: 'Eight players, three rounds',
        players: matchPlayers([{ name: 'Alice' }, { name: 'Bob', userId: 'bob-id' }]),
        matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] }] }],
        overrides: { Bob: { wins: 3, losses: 0, draws: 1 } },
        trophy: ['Alice'],
      }),
    );
  });

  it('calls associateDecksWithNewDraft once when the record has no draft', async () => {
    const decks = { 1: { mainboard: ['alice-oracle'], sideboard: [] } };

    const res = await save(fullPayload({ decks }));

    expect(res.status).toBe(200);
    expect(associateDecksWithNewDraft).toHaveBeenCalledTimes(1);
    expect(associateDecksWithExistingDraft).not.toHaveBeenCalled();
    // That writer creates the draft, bumps cube.numDecks, sets record.draft and writes the
    // record itself, so the record has to reach it fully applied and must not be written twice.
    expect(recordDao.update).not.toHaveBeenCalled();
    expect(associateDecksWithNewDraft).toHaveBeenCalledWith(
      cube,
      expect.objectContaining({ name: 'Tuesday Cube Night', trophy: [] }),
      { 1: { mainboard: ['alice-oracle'], sideboard: [] } },
    );
  });

  it('calls associateDecksWithExistingDraft once, with only the submitted seats', async () => {
    const { draft } = uploadDraft();
    const stored = existingRecord({ draft: draft.id });
    (recordDao.getById as jest.Mock).mockResolvedValue(stored);
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    const res = await save(
      fullPayload({ decks: { 2: { mainboard: ['bob-oracle'], sideboard: ['bob-side-oracle'] } } }, stored, draft),
    );

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

  it('does not rebase matches, overrides or trophy on a same-save player swap', async () => {
    const res = await save(
      fullPayload({
        // Alice and Bob trade places; the submission already keys everything below by the
        // new arrangement's names (identical to the old ones here, since neither is renamed).
        players: [{ name: 'Bob' }, { name: 'Alice' }],
        seatOrder: [1, 0],
        matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] }] }],
        overrides: { Alice: { wins: 2, losses: 1, draws: 0 } },
        trophy: ['Alice'],
      }),
    );

    expect(res.status).toBe(200);
    expect(savedRecord().matches).toEqual([{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] }] }]);
    expect(savedRecord().overrides).toEqual({ Alice: { wins: 2, losses: 1, draws: 0 } });
    expect(savedRecord().trophy).toEqual(['Alice']);
  });

  it('realigns seats before writing decks when the player order changed', async () => {
    const { draft, alicePool, bobPool } = uploadDraft();
    const stored = existingRecord({
      draft: draft.id,
      // Explicit ids so the stamped seats below assert against a known value rather than a
      // freshly minted uuid — the other three stamping sites (edit/players, contribute,
      // uploaddeck) all have a direct `seat.playerId` assertion; this is enter.ts's realign
      // path, the deck-misattribution surface the spec calls "the dangerous part".
      players: [
        { id: 'alice-id', name: 'Alice' },
        { id: 'bob-id', name: 'Bob' },
      ],
    });
    (recordDao.getById as jest.Mock).mockResolvedValue(stored);
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    // The deck writer mutates the seats it is handed, so snapshot them at call time:
    // asserting on the draft afterwards cannot tell realign-then-write from write-then-realign.
    let seatsWhenDecksWereWritten: any[] = [];
    (associateDecksWithExistingDraft as jest.Mock).mockImplementation(async (_cube, handedDraft) => {
      seatsWhenDecksWereWritten = handedDraft.seats.map((seat: any) => ({ ...seat }));
    });

    const res = await save(
      fullPayload(
        {
          players: [{ name: 'Bob' }, { name: 'Alice' }],
          seatOrder: [1, 0],
          decks: { 1: { mainboard: ['bob-oracle'], sideboard: [] } },
        },
        stored,
        draft,
      ),
    );

    expect(res.status).toBe(200);
    // Seat 1 must already be Bob's old seat, or his submitted deck lands on Alice.
    expect(seatsWhenDecksWereWritten.map((seat) => seat.title)).toEqual(['Bob', 'Alice']);
    // And stamped with the player id that now sits there, not the one the seat used to hold —
    // a stale or absent id here is exactly how a deck gets misattributed on an unrelated save.
    expect(seatsWhenDecksWereWritten.map((seat) => seat.playerId)).toEqual(['bob-id', 'alice-id']);
    expect(seatsWhenDecksWereWritten.map((seat) => seat.mainboard)).toEqual([bobPool, alicePool]);
  });

  it('clears a seat submitted with an empty mainboard', async () => {
    const { draft } = uploadDraft();
    const stored = existingRecord({ draft: draft.id });
    (recordDao.getById as jest.Mock).mockResolvedValue(stored);
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    const res = await save(fullPayload({ decks: { 1: { mainboard: [], sideboard: [] } } }, stored, draft));

    expect(res.status).toBe(200);
    // An emptied seat is a real edit, not an absent one: the writer resets a seat given an
    // empty mainboard, but only for the seats it is handed.
    expect(associateDecksWithExistingDraft).toHaveBeenCalledWith(cube, draft, {
      1: { mainboard: [], sideboard: [] },
    });
  });

  it('does not hand an empty deck list to the existing-draft writer', async () => {
    const { draft } = uploadDraft();
    const stored = existingRecord({ draft: draft.id });
    (recordDao.getById as jest.Mock).mockResolvedValue(stored);
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    const res = await save(
      fullPayload({ players: [{ name: 'Bob' }, { name: 'Alice' }], seatOrder: [1, 0], decks: {} }, stored, draft),
    );

    expect(res.status).toBe(200);
    expect(associateDecksWithExistingDraft).not.toHaveBeenCalled();
    // The seat realignment still has to be persisted, in exactly one draft write.
    expect(draftDao.update).toHaveBeenCalledTimes(1);
    expect((draftDao.update as jest.Mock).mock.calls[0][0].seats.map((seat: any) => seat.title)).toEqual([
      'Bob',
      'Alice',
    ]);
  });

  // A draft that came from a file or Hedron import has no seat titles at all:
  // associateDecksWithNewDraft deliberately leaves them unset so createDraft names each seat
  // by its mainboard archetype. Realigning stamps the player names over them, and
  // DraftDynamoDao.update then renames the whole draft after seat one — so an unconditional
  // realign would retitle the draft and every deck heading on a save that touched neither.
  it('does not write the draft when nothing about the seats changed', async () => {
    const { draft } = uploadDraft({
      seats: [
        { mainboard: pool(2, [0]), sideboard: pool(1) },
        { mainboard: pool(2, [1]), sideboard: pool(1) },
      ],
    });
    const stored = existingRecord({ draft: draft.id });
    (recordDao.getById as jest.Mock).mockResolvedValue(stored);
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    const res = await save(fullPayload({ description: 'Rewrote the event writeup' }, stored, draft));

    expect(res.status).toBe(200);
    expect(draftDao.update).not.toHaveBeenCalled();
    expect(associateDecksWithExistingDraft).not.toHaveBeenCalled();
    // The seats are left exactly as the import made them, untitled.
    expect(draft.seats.map((seat: any) => seat.title)).toEqual([undefined, undefined]);
    // The record itself is still saved — this is only about the draft.
    expect(recordDao.update).toHaveBeenCalledTimes(1);
    expect(savedRecord().description).toEqual('Rewrote the event writeup');
  });

  it('writes the draft when a player is renamed in place', async () => {
    const { draft } = uploadDraft();
    const stored = existingRecord({ draft: draft.id });
    (recordDao.getById as jest.Mock).mockResolvedValue(stored);
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    const res = await save(fullPayload({ players: [{ name: 'Alicia' }, { name: 'Bob' }] }, stored, draft));

    expect(res.status).toBe(200);
    // Renames still propagate to the seat titles, matching what edit/players.ts does.
    expect(draftDao.update).toHaveBeenCalledTimes(1);
    expect((draftDao.update as jest.Mock).mock.calls[0][0].seats.map((seat: any) => seat.title)).toEqual([
      'Alicia',
      'Bob',
    ]);
  });

  it('writes the draft when a player links their account', async () => {
    const { draft } = uploadDraft();
    const stored = existingRecord({ draft: draft.id });
    (recordDao.getById as jest.Mock).mockResolvedValue(stored);
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    const res = await save(
      fullPayload({ players: [{ name: 'Alice', userId: 'alice-id' }, { name: 'Bob' }] }, stored, draft),
    );

    expect(res.status).toBe(200);
    // The seat owner is what changed, so the draft still has to be rewritten.
    expect(draftDao.update).toHaveBeenCalledTimes(1);
    expect((draftDao.update as jest.Mock).mock.calls[0][0].seats.map((seat: any) => seat.owner)).toEqual([
      'alice-id',
      undefined,
    ]);
  });

  it('drops a trophy entry keyed to a player not in the submitted list', async () => {
    const res = await save(fullPayload({ trophy: ['Alice', 'Ghost'] }));

    expect(res.status).toBe(200);
    expect(savedRecord().trophy).toEqual(['Alice']);
  });

  it('accepts a round with no matches', async () => {
    const matches = [{ matches: [] }, { matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 0, 0] }] }];

    const res = await save(fullPayload({ matches }));

    expect(res.status).toBe(200);
    expect(savedRecord().matches).toEqual(matches);
  });

  it('accepts a match with an empty player name', async () => {
    const matches = [{ matches: [{ p1: 'Alice', p2: '', results: [2, 0, 0] }] }];

    const res = await save(fullPayload({ matches }));

    expect(res.status).toBe(200);
    expect(savedRecord().matches).toEqual(matches);
  });

  it('rejects more than 16 players', async () => {
    const players = Array.from({ length: 17 }, (_, index) => ({ name: `Player ${index}` }));

    const res = await save(fullPayload({ players, seatOrder: players.map((_, index) => index) }));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: 'false', message: expect.any(String) });
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('rejects a seatOrder that does not line up with the players', async () => {
    const res = await save(fullPayload({ seatOrder: [0] }));

    expect(res.status).toBe(400);
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('rejects two players sharing a name', async () => {
    // Overrides and trophies are keyed by name, so duplicates make a save ambiguous.
    const res = await save(fullPayload({ players: [{ name: 'Alice' }, { name: 'Alice' }] }));

    expect(res.status).toBe(400);
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('starts a new draft when the record points at one that has been deleted', async () => {
    const stored = existingRecord({ draft: 'missing-draft' });
    (recordDao.getById as jest.Mock).mockResolvedValue(stored);
    (draftDao.getById as jest.Mock).mockResolvedValue(undefined);

    const res = await save(fullPayload({ decks: { 1: { mainboard: ['alice-oracle'], sideboard: [] } } }, stored));

    expect(res.status).toBe(200);
    expect(associateDecksWithExistingDraft).not.toHaveBeenCalled();
    expect(associateDecksWithNewDraft).toHaveBeenCalledTimes(1);
    expect(draftDao.update).not.toHaveBeenCalled();
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('rejects a mainboard of more than 200 oracle ids', async () => {
    const mainboard = Array.from({ length: 201 }, (_, index) => `oracle-${index}`);

    const res = await save(fullPayload({ decks: { 1: { mainboard, sideboard: [] } } }));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: 'false', message: expect.any(String) });
    expect(associateDecksWithNewDraft).not.toHaveBeenCalled();
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('rejects deck edits when the draft type is not UPLOAD', async () => {
    const { draft } = uploadDraft({ type: DRAFT_TYPES.DRAFT });
    const stored = existingRecord({ draft: draft.id });
    (recordDao.getById as jest.Mock).mockResolvedValue(stored);
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    const res = await save(fullPayload({ decks: { 1: { mainboard: ['alice-oracle'], sideboard: [] } } }, stored));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: 'false', message: expect.any(String) });
    // Nothing at all is written: a partial save would leave the mounted page out of step.
    expect(associateDecksWithExistingDraft).not.toHaveBeenCalled();
    expect(draftDao.update).not.toHaveBeenCalled();
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('saves the rest of a record whose draft is not an upload when no decks are submitted', async () => {
    const { draft } = uploadDraft({ type: DRAFT_TYPES.DRAFT });
    const stored = existingRecord({ draft: draft.id });
    (recordDao.getById as jest.Mock).mockResolvedValue(stored);
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    const res = await save(fullPayload({ decks: {} }, stored));

    expect(res.status).toBe(200);
    expect(recordDao.update).toHaveBeenCalledTimes(1);
    expect(savedRecord().name).toBe('Tuesday Cube Night');
    // A played draft is never written here. Realigning it would overwrite every seat's real
    // drafter and generated title with the record's player list.
    expect(draftDao.update).not.toHaveBeenCalled();
  });

  it('renames a player on a record whose draft is not an upload, leaving the draft untouched', async () => {
    const { draft } = uploadDraft({ type: DRAFT_TYPES.DRAFT });
    const stored = existingRecord({ draft: draft.id });
    (recordDao.getById as jest.Mock).mockResolvedValue(stored);
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    // Same seats, same order: only the display name in the record changes.
    const res = await save(fullPayload({ players: [{ name: 'Alicia' }, { name: 'Bob' }], seatOrder: [0, 1] }, stored));

    expect(res.status).toBe(200);
    expect(recordDao.update).toHaveBeenCalledTimes(1);
    expect(savedRecord().players).toEqual(matchPlayers([{ name: 'Alicia' }, { name: 'Bob' }]));
    expect(draftDao.update).not.toHaveBeenCalled();
    // The seat still belongs to whoever actually drafted it.
    expect(draft.seats.map((seat: any) => seat.title)).toEqual(['Alice', 'Bob']);
  });

  it('rejects reordering players on a record whose draft is not an upload', async () => {
    const { draft } = uploadDraft({ type: DRAFT_TYPES.DRAFT });
    const stored = existingRecord({ draft: draft.id });
    (recordDao.getById as jest.Mock).mockResolvedValue(stored);
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    const res = await save(fullPayload({ players: [{ name: 'Bob' }, { name: 'Alice' }], seatOrder: [1, 0] }, stored));

    expect(res.status).toBe(400);
    // A reorder without carrying the seats would attribute each played deck to the wrong
    // person; carrying them would desynchronize the pack history tied to seats by position.
    expect(res.body.message).toMatch(/played draft/);
    expect(res.body.message).toMatch(/reordered/);
    expect(draftDao.update).not.toHaveBeenCalled();
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('rejects adding a player to a record whose draft is not an upload', async () => {
    const { draft } = uploadDraft({ type: DRAFT_TYPES.DRAFT });
    const stored = existingRecord({ draft: draft.id });
    (recordDao.getById as jest.Mock).mockResolvedValue(stored);
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    const res = await save(
      fullPayload({ players: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }], seatOrder: [0, 1, -1] }, stored),
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/played draft/);
    expect(res.body.message).toMatch(/added/);
    expect(draftDao.update).not.toHaveBeenCalled();
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('rejects dropping a player from a record whose draft is not an upload', async () => {
    const { draft } = uploadDraft({ type: DRAFT_TYPES.DRAFT });
    const stored = existingRecord({ draft: draft.id });
    (recordDao.getById as jest.Mock).mockResolvedValue(stored);
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    // Bob is dropped: seat 1 would be discarded along with its pickorder and trashorder.
    const res = await save(fullPayload({ players: [{ name: 'Alice' }], seatOrder: [0] }, stored));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/played draft/);
    expect(res.body.message).toMatch(/removed/);
    expect(draftDao.update).not.toHaveBeenCalled();
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('does not increment cube.numDecks when updating an existing draft', async () => {
    const { draft } = uploadDraft();
    const stored = existingRecord({ draft: draft.id });
    (recordDao.getById as jest.Mock).mockResolvedValue(stored);
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    const res = await save(
      fullPayload({ decks: { 1: { mainboard: ['alice-oracle'], sideboard: [] } } }, stored, draft),
    );

    expect(res.status).toBe(200);
    // Only associateDecksWithNewDraft counts a new deck, and it does the increment itself.
    expect(cube.numDecks).toBe(0);
    expect(cubeDao.update).not.toHaveBeenCalled();
  });
});

describe('transcribeRecordPageHandler', () => {
  const cube = createCube({ id: 'my-cube' });
  const flash = jest.fn();

  const record = {
    id: 'rec-1',
    cube: cube.id,
    date: 1,
    name: 'A Record',
    description: '',
    players: [{ name: 'Alice', userId: 'alice-id' }, { name: 'Bob' }],
    matches: [],
    trophy: [],
  };

  const open = (user = cube.owner) =>
    call(transcribeRecordPageHandler).as(user).withFlash(flash).withParams({ id: 'rec-1' }).send();

  beforeEach(() => {
    jest.clearAllMocks();
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (recordDao.getById as jest.Mock).mockResolvedValue(record);
    (userDao.batchGet as jest.Mock).mockResolvedValue([{ id: 'alice-id', username: 'Alice' }]);
  });

  it('renders the workspace with the cube, record, hydrated draft and linked players', async () => {
    const draft = { id: 'draft-1', cube: cube.id };
    (recordDao.getById as jest.Mock).mockResolvedValue({ ...record, draft: 'draft-1' });
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    await open();

    expect(userDao.batchGet).toHaveBeenCalledWith(['alice-id']);
    expect(render).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'RecordTranscribePage',
      { cube, record: { ...record, draft: 'draft-1' }, draft, players: [{ id: 'alice-id', username: 'Alice' }] },
      expect.anything(),
    );
  });

  // The page is an editing surface, not a view of the record, so being able to see the cube
  // is not enough to open it.
  it('turns away a user who cannot edit the cube', async () => {
    await open(createUser());

    expect(render).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/cube/record/rec-1');
  });

  it('turns away a record that belongs to another cube', async () => {
    (recordDao.getById as jest.Mock).mockResolvedValue({ ...record, cube: 'other-cube' });

    await open();

    expect(render).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/404');
  });
});
