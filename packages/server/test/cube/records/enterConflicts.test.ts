import { DRAFT_TYPES } from '@utils/datatypes/Draft';
import { setupPicks } from '@utils/draftutil';

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

import { cubeDao, draftDao, recordDao } from '../../../src/dynamo/daos';
import { transcribeRecordHandler } from '../../../src/router/routes/cube/records/enter';
import {
  associateDecksWithExistingDraft,
  associateDecksWithNewDraft,
} from '../../../src/router/routes/cube/records/uploaddeck';
import { createCard, createCardDetails, createCube } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

describe('transcribeRecordHandler — conflict detection', () => {
  const cube = createCube({ id: 'my-cube' });

  const existingRecord = (overrides: any = {}) => ({
    id: 'rec-1',
    cube: cube.id,
    date: 1,
    name: 'Old name',
    description: 'Old description',
    players: [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
    ],
    matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] }] }],
    overrides: {},
    trophy: [],
    dateCreated: 1,
    dateLastUpdated: 1,
    ...overrides,
  });

  // A seat pool holding exactly the oracle ids at `cardIndexes` into `draft.cards`, in one
  // slot — only the ordered flattened content is under test, not row/column placement.
  const seatPool = (cardIndexes: number[]): number[][][] => {
    const pool = setupPicks(2, 8);
    pool[0]![0] = cardIndexes;
    return pool;
  };

  const uploadDraft = (overrides: any = {}) => ({
    id: 'draft-1',
    cube: cube.id,
    type: DRAFT_TYPES.UPLOAD,
    cards: [createCard({ details: createCardDetails({ oracle_id: 'alice-oracle' }) })],
    seats: [
      { title: 'Alice', mainboard: seatPool([0]), sideboard: setupPicks(1, 8), playerId: 'p1' },
      { title: 'Bob', mainboard: setupPicks(2, 8), sideboard: setupPicks(1, 8), playerId: 'p2' },
    ],
    ...overrides,
  });

  const save = (body: any, user = cube.owner) =>
    call(transcribeRecordHandler).as(user).withParams({ id: 'rec-1' }).withBody(body).send();

  const savedRecord = () => (recordDao.update as jest.Mock).mock.calls[0]?.[0];

  beforeEach(() => {
    jest.clearAllMocks();
    cube.numDecks = 0;
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
    (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [], maybeboard: [] });
    (recordDao.getById as jest.Mock).mockResolvedValue(existingRecord());
    (draftDao.getById as jest.Mock).mockResolvedValue(undefined);
  });

  it('applies a section whose baseline matches what is stored', async () => {
    const res = await save({
      sections: { overview: { name: 'New name', date: 2, description: 'New description' } },
      baselines: { overview: { name: 'Old name', date: 1, description: 'Old description' } },
    });

    expect(res.status).toBe(200);
    expect(res.body.applied).toEqual(['overview']);
    expect(res.body.conflicts).toEqual([]);
    expect(savedRecord().name).toBe('New name');
    expect(savedRecord().date).toBe(2);
    expect(savedRecord().description).toBe('New description');
  });

  it('refuses a section whose baseline differs, and names it', async () => {
    const res = await save({
      sections: { overview: { name: 'New name', date: 2, description: 'New description' } },
      // Stale baseline: someone else already changed the name before this save landed.
      baselines: { overview: { name: 'Someone else changed it', date: 1, description: 'Old description' } },
    });

    expect(res.status).toBe(200);
    expect(res.body.applied).toEqual([]);
    expect(res.body.conflicts).toEqual([
      { section: 'overview', stored: { name: 'Old name', date: 1, description: 'Old description' } },
    ]);
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('applies the clean sections of a save that had one conflict', async () => {
    const res = await save({
      sections: {
        overview: { name: 'New name', date: 2, description: 'New description' },
        trophy: { trophy: ['Alice'] },
      },
      baselines: {
        overview: { name: 'Old name', date: 1, description: 'Old description' },
        trophy: { trophy: ['Someone else already changed this'] },
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.applied).toEqual(['overview']);
    expect(res.body.conflicts).toEqual([{ section: 'trophy', stored: { trophy: [] } }]);
    expect(savedRecord().name).toBe('New name');
    expect(savedRecord().trophy).toEqual([]);
  });

  it('does not write a section absent from the payload', async () => {
    // A rounds-only save: players, overrides, trophy and decks are not in `sections` at all.
    const res = await save({
      sections: {
        rounds: { matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 1] }] }] },
      },
      baselines: {
        rounds: { matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] }] }] },
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.applied).toEqual(['rounds']);
    expect(savedRecord().matches).toEqual([{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 1] }] }]);
    // Untouched sections persisted exactly as stored, including their shared ids.
    expect(savedRecord().players).toEqual([
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
    ]);
    expect(savedRecord().overrides).toEqual({});
    expect(savedRecord().trophy).toEqual([]);
  });

  it('reports a conflict when another writer removed a player this save references', async () => {
    // Bob has already been removed from the stored record by another writer.
    (recordDao.getById as jest.Mock).mockResolvedValue(existingRecord({ players: [{ id: 'p1', name: 'Alice' }] }));

    const res = await save({
      sections: { 'overrides:p2': { wins: 2, losses: 0, draws: 0 } },
      baselines: { overrides: { p2: null } },
    });

    expect(res.status).toBe(200);
    expect(res.body.applied).toEqual([]);
    expect(res.body.conflicts).toEqual([{ section: 'overrides:p2', stored: null }]);
    // Nothing is resurrected: no override is written for a player who no longer exists, and
    // nothing else applied this save either, so there is nothing to write at all.
    expect(recordDao.update).not.toHaveBeenCalled();
  });

  it('accepts a first deck submission on a record with no draft', async () => {
    // record.draft is absent — every deck baseline is empty, so a first submission cannot conflict.
    const res = await save({
      sections: { 'overrides:p1': null, 'decks:p1': { mainboard: ['alice-oracle'], sideboard: [] } },
      baselines: { overrides: { p1: null }, decks: { p1: { mainboard: [], sideboard: [] } } },
    });

    expect(res.status).toBe(200);
    expect(res.body.conflicts).toEqual([]);
    expect(res.body.applied).toEqual(expect.arrayContaining(['decks:p1']));
    expect(associateDecksWithNewDraft).toHaveBeenCalledTimes(1);
    expect(associateDecksWithNewDraft).toHaveBeenCalledWith(cube, expect.anything(), {
      1: { mainboard: ['alice-oracle'], sideboard: [] },
    });
  });

  it('resolves decks keyed by seat index for a record whose players have no ids', async () => {
    const legacyRecord = existingRecord({
      players: [{ name: 'Alice' }, { name: 'Bob' }],
    });
    (recordDao.getById as jest.Mock).mockResolvedValue(legacyRecord);
    const draft = uploadDraft();
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);
    (recordDao.getById as jest.Mock).mockResolvedValue({ ...legacyRecord, draft: draft.id });

    const res = await save({
      // No player ids exist yet, so the client keys Bob's deck by his seat position (1).
      sections: { 'decks:1': { mainboard: ['bob-new-oracle'], sideboard: [] } },
      baselines: { decks: { '1': { mainboard: [], sideboard: [] } } },
    });

    expect(res.status).toBe(200);
    expect(res.body.conflicts).toEqual([]);
    expect(associateDecksWithExistingDraft).toHaveBeenCalledWith(cube, draft, {
      2: { mainboard: ['bob-new-oracle'], sideboard: [] },
    });
  });

  it('rebases a renamed player before comparing the rounds section', async () => {
    // A contributor already renamed Alice to "Al" via the share link, which also rewrote the
    // stored matches to use the new name.
    (recordDao.getById as jest.Mock).mockResolvedValue(
      existingRecord({
        players: [
          { id: 'p1', name: 'Al' },
          { id: 'p2', name: 'Bob' },
        ],
        matches: [{ matches: [{ p1: 'Al', p2: 'Bob', results: [2, 1, 0] }] }],
      }),
    );

    const res = await save({
      sections: {
        // The owner never saw the contributor's rename, so their own edit is still keyed to
        // "Alice". Their players section (unrelated: linking an account) also still says
        // "Alice", which is what makes the players conflict and the rounds section
        // independent: the baseline needed to tell them apart is the players section's own.
        players: {
          players: [
            { id: 'p1', name: 'Alice', userId: 'alice-account' },
            { id: 'p2', name: 'Bob' },
          ],
          seatOrder: [0, 1],
        },
        rounds: { matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 1] }] }] },
      },
      baselines: {
        players: {
          players: [
            { id: 'p1', name: 'Alice' },
            { id: 'p2', name: 'Bob' },
          ],
          seatOrder: [0, 1],
        },
        rounds: { matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] }] }] },
      },
    });

    expect(res.status).toBe(200);
    // The players section itself genuinely conflicts: the contributor's rename invalidated it.
    expect(res.body.conflicts.map((c: any) => c.section)).toEqual(['players']);
    expect(res.body.applied).toEqual(['rounds']);
    // Written under the name the player actually holds in storage, not the owner's stale one.
    expect(savedRecord().matches).toEqual([{ matches: [{ p1: 'Al', p2: 'Bob', results: [2, 1, 1] }] }]);
  });

  it('rebases a rounds-only save against a rename it never saw, via `identity`', async () => {
    // Spec §3's own motivating scenario: a contributor renamed Alice to "Al" via the share
    // link since the owner's workspace loaded, which also rewrote the stored matches to the
    // new name. The owner only edited round one — `players` is untouched and absent from
    // `sections` entirely, exactly what a real client sends for this save, so the only way
    // the server can learn the old name was "Alice" is `identity`, sent on every save.
    (recordDao.getById as jest.Mock).mockResolvedValue(
      existingRecord({
        players: [
          { id: 'p1', name: 'Al' },
          { id: 'p2', name: 'Bob' },
        ],
        matches: [{ matches: [{ p1: 'Al', p2: 'Bob', results: [2, 1, 0] }] }],
      }),
    );

    const res = await save({
      sections: {
        rounds: { matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 1] }] }] },
      },
      baselines: {
        rounds: { matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] }] }] },
      },
      // The player list as the owner's workspace loaded it — still "Alice", because this save
      // never touched players and so never re-seeded it.
      identity: {
        players: [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' },
        ],
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.conflicts).toEqual([]);
    expect(res.body.applied).toEqual(['rounds']);
    // Written under the name the player actually holds in storage, not the owner's stale one.
    expect(savedRecord().matches).toEqual([{ matches: [{ p1: 'Al', p2: 'Bob', results: [2, 1, 1] }] }]);
  });

  it('rebases a trophy-only save against a rename it never saw, via `identity`', async () => {
    (recordDao.getById as jest.Mock).mockResolvedValue(
      existingRecord({
        players: [
          { id: 'p1', name: 'Al' },
          { id: 'p2', name: 'Bob' },
        ],
        trophy: ['Al'],
      }),
    );

    const res = await save({
      sections: {
        trophy: { trophy: ['Alice', 'Bob'] },
      },
      baselines: {
        trophy: { trophy: ['Alice'] },
      },
      identity: {
        players: [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' },
        ],
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.conflicts).toEqual([]);
    expect(res.body.applied).toEqual(['trophy']);
    expect(savedRecord().trophy).toEqual(['Al', 'Bob']);
  });

  it('echoes minted player ids back in the response', async () => {
    (recordDao.getById as jest.Mock).mockResolvedValue(
      existingRecord({ players: [{ name: 'Alice' }, { name: 'Bob' }] }),
    );

    const res = await save({
      sections: {
        players: {
          players: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }],
          seatOrder: [0, 1, -1],
        },
      },
      baselines: {
        players: { players: [{ name: 'Alice' }, { name: 'Bob' }], seatOrder: [0, 1] },
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.applied).toEqual(['players']);
    const echoedPlayers = res.body.record.players.players;
    expect(echoedPlayers).toHaveLength(3);
    for (const player of echoedPlayers) {
      expect(typeof player.id).toBe('string');
      expect(player.id.length).toBeGreaterThan(0);
    }
  });

  it("still refuses to write a played draft's seats", async () => {
    const draft = uploadDraft({ type: DRAFT_TYPES.DRAFT });
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);
    (recordDao.getById as jest.Mock).mockResolvedValue(existingRecord({ draft: draft.id }));

    const res = await save({
      sections: {
        players: {
          players: [
            { id: 'p2', name: 'Bob' },
            { id: 'p1', name: 'Alice' },
          ],
          seatOrder: [1, 0],
        },
      },
      baselines: {
        players: {
          players: [
            { id: 'p1', name: 'Alice' },
            { id: 'p2', name: 'Bob' },
          ],
          seatOrder: [0, 1],
        },
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/played draft/);
    expect(draftDao.update).not.toHaveBeenCalled();
    expect(recordDao.update).not.toHaveBeenCalled();
  });
});
