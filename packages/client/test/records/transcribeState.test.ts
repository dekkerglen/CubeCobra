import Card from '@utils/datatypes/Card';
import Draft, { DRAFT_TYPES } from '@utils/datatypes/Draft';
import RecordType from '@utils/datatypes/Record';
import { SectionBaselines } from '@utils/records/recordSections';

import { createCard, createCardDetails, createCardWithoutDetails } from '../../../server/test/test-utils/data';
import {
  applyPlayerEdit,
  areSeatsEditable,
  dirtySections,
  fallbackRecord,
  isDirty,
  keepLocalSection,
  keepStoredSection,
  MAX_DECK_CARDS,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MAX_ROUNDS,
  movePastes,
  reconcileAfterSave,
  resolvePlayerIndex,
  SaveConflict,
  seedTranscribeState,
  setDeckCards,
  toTranscribePayload,
  TranscribeState,
  validationErrors,
} from '../../src/records/transcribe/transcribeState';

const createRecord = (overrides?: Partial<RecordType>): RecordType => ({
  id: 'record-1',
  cube: 'cube-1',
  date: 1700000000000,
  name: 'Tuesday Night Cube',
  description: 'Eight players, three rounds.',
  players: [{ name: 'Alice', userId: 'alice-id' }, { name: 'Bob' }],
  matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] }] }],
  trophy: ['Alice'],
  overrides: { Bob: { wins: 1, losses: 2, draws: 0 } },
  ...overrides,
});

// A seat pool is number[][][] of indices into draft.cards; one pile is enough here,
// since what matters is the flattening, not the pile layout.
const seatPool = (...indices: number[]): number[][][] => [[indices]];

const createDraft = (cards: Card[], seats: Draft['seats'], overrides?: Partial<Draft>): Draft =>
  ({
    id: 'draft-1',
    cube: 'cube-1',
    cubeOwner: 'owner-id',
    date: 1700000000000,
    name: 'Tuesday Night Cube',
    complete: true,
    basics: [],
    type: DRAFT_TYPES.UPLOAD,
    cards,
    seats,
    ...overrides,
  }) as Draft;

describe('seedTranscribeState', () => {
  it('seeds players, matches, trophy and overrides from the record', () => {
    const record = createRecord();

    const state = seedTranscribeState(record);

    expect(state.name).toEqual('Tuesday Night Cube');
    expect(state.date).toEqual(1700000000000);
    expect(state.description).toEqual('Eight players, three rounds.');
    expect(state.players).toEqual([{ name: 'Alice', userId: 'alice-id' }, { name: 'Bob' }]);
    expect(state.matches).toEqual([{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] }] }]);
    expect(state.trophy).toEqual(['Alice']);
    expect(state.overrides).toEqual({ Bob: { wins: 1, losses: 2, draws: 0 } });
  });

  it('copies the record rather than aliasing it', () => {
    const record = createRecord();

    const state = seedTranscribeState(record);
    state.players[0]!.name = 'Renamed';
    state.trophy.push('Bob');
    state.matches[0]!.matches[0]!.p1 = 'Renamed';

    expect(record.players[0]!.name).toEqual('Alice');
    expect(record.trophy).toEqual(['Alice']);
    expect(record.matches[0]!.matches[0]!.p1).toEqual('Alice');
  });

  it('defaults matches, trophy and overrides that the record is missing', () => {
    const record = createRecord({
      matches: undefined as unknown as RecordType['matches'],
      trophy: undefined as unknown as RecordType['trophy'],
      overrides: undefined,
    });

    const state = seedTranscribeState(record);

    expect(state.matches).toEqual([]);
    expect(state.trophy).toEqual([]);
    expect(state.overrides).toEqual({});
  });

  it('flattens an existing draft seat into mainboard and sideboard details', () => {
    const cards = [createCard(), createCard(), createCard(), createCard()];
    const draft = createDraft(cards, [
      { mainboard: seatPool(0, 2), sideboard: seatPool(3) },
      { mainboard: seatPool(1), sideboard: [] },
    ] as Draft['seats']);

    const state = seedTranscribeState(createRecord(), draft);

    expect(state.decks[0]!.mainboard).toEqual([cards[0]!.details, cards[2]!.details]);
    expect(state.decks[0]!.sideboard).toEqual([cards[3]!.details]);
    expect(state.decks[1]!.mainboard).toEqual([cards[1]!.details]);
    expect(state.decks[1]!.sideboard).toEqual([]);
  });

  it('drops seat card indices with no details', () => {
    const withDetails = createCard();
    const cards = [createCardWithoutDetails(), withDetails];
    const draft = createDraft(cards, [{ mainboard: seatPool(0, 1, 7), sideboard: [] }] as Draft['seats']);

    const state = seedTranscribeState(createRecord({ players: [{ name: 'Alice' }] }), draft);

    expect(state.decks[0]!.mainboard).toEqual([withDetails.details]);
  });

  it('marks every seeded deck not dirty', () => {
    const cards = [createCard(), createCard()];
    const draft = createDraft(cards, [
      { mainboard: seatPool(0), sideboard: [] },
      { mainboard: seatPool(1), sideboard: [] },
    ] as Draft['seats']);

    const state = seedTranscribeState(createRecord(), draft);

    expect(Object.values(state.decks).map((deck) => deck.dirty)).toEqual([false, false]);
  });

  it('marks decks editable when the record has no draft', () => {
    const state = seedTranscribeState(createRecord());

    expect(Object.values(state.decks).map((deck) => deck.editable)).toEqual([true, true]);
    expect(Object.values(state.decks).map((deck) => deck.mainboard)).toEqual([[], []]);
  });

  it('marks decks editable for an UPLOAD draft and not editable for any other type', () => {
    const cards = [createCard()];
    const seats = [
      { mainboard: seatPool(0), sideboard: [] },
      { mainboard: [], sideboard: [] },
    ] as Draft['seats'];

    const uploaded = seedTranscribeState(createRecord(), createDraft(cards, seats, { type: DRAFT_TYPES.UPLOAD }));
    expect(Object.values(uploaded.decks).map((deck) => deck.editable)).toEqual([true, true]);

    for (const type of [DRAFT_TYPES.DRAFT, DRAFT_TYPES.GRID, DRAFT_TYPES.SEALED, DRAFT_TYPES.HOUSMAN]) {
      const played = seedTranscribeState(createRecord(), createDraft(cards, seats, { type }));
      expect(Object.values(played.decks).map((deck) => deck.editable)).toEqual([false, false]);
    }
  });

  it('seeds an identity seatOrder', () => {
    const record = createRecord({ players: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }] });

    const state = seedTranscribeState(record);

    expect(state.seatOrder).toEqual([0, 1, 2]);
  });

  it('gives a player with no seat an empty editable deck', () => {
    const cards = [createCard()];
    const draft = createDraft(cards, [{ mainboard: seatPool(0), sideboard: seatPool(0) }] as Draft['seats']);

    const state = seedTranscribeState(createRecord(), draft);

    expect(state.decks[1]).toEqual({ mainboard: [], sideboard: [], dirty: false, editable: true });
  });
});

describe('toTranscribePayload', () => {
  const threePlayerState = () =>
    seedTranscribeState(
      createRecord({
        players: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }],
        overrides: {},
        trophy: [],
      }),
    );

  const idPlayerState = () =>
    seedTranscribeState(
      createRecord({
        players: [
          { name: 'Alice', id: 'alice-id' },
          { name: 'Bob', id: 'bob-id' },
        ],
        overrides: {},
        trophy: [],
      }),
    );

  const seedBoth = (record: RecordType) => ({
    state: seedTranscribeState(record),
    seeded: seedTranscribeState(record),
  });

  it('omits every section when nothing changed', () => {
    const { state, seeded } = seedBoth(createRecord());

    const payload = toTranscribePayload(state, seeded);

    expect(payload.sections).toEqual({});
  });

  it('sends only overview when only the name changed', () => {
    const { state, seeded } = seedBoth(createRecord());
    state.name = 'Wednesday Night Cube';

    const payload = toTranscribePayload(state, seeded);

    expect(Object.keys(payload.sections)).toEqual(['overview']);
    expect(payload.sections.overview).toEqual({
      name: 'Wednesday Night Cube',
      date: 1700000000000,
      description: 'Eight players, three rounds.',
    });
  });

  it('sends a per-player override key, not the whole overrides block', () => {
    const record = createRecord({
      players: [
        { name: 'Alice', id: 'alice-id' },
        { name: 'Bob', id: 'bob-id' },
        { name: 'Carol', id: 'carol-id' },
      ],
      overrides: {},
      trophy: [],
    });
    const { state, seeded } = seedBoth(record);
    // Bob is explicitly set back to undefined — the same as never having touched it — and
    // must not appear as a changed section alongside Alice and Carol's real edits.
    state.overrides = {
      Alice: { wins: 2, losses: 0, draws: 1 },
      Bob: undefined,
      Carol: { wins: 0, losses: 2, draws: 0 },
    };

    const payload = toTranscribePayload(state, seeded);

    expect(Object.keys(payload.sections)).toEqual(['overrides:alice-id', 'overrides:carol-id']);
    expect(payload.sections['overrides:alice-id']).toEqual({ wins: 2, losses: 0, draws: 1 });
    expect(payload.sections['overrides:carol-id']).toEqual({ wins: 0, losses: 2, draws: 0 });
  });

  it('marks every player override dirty when the results mode changed', () => {
    const record = createRecord({
      players: [
        { name: 'Alice', id: 'alice-id' },
        { name: 'Bob', id: 'bob-id' },
      ],
      overrides: {},
    });
    const { state, seeded } = seedBoth(record);
    // Nothing about the data itself changes — only the mode toggles to records, which gives
    // every player an explicit 0-0-0 where none was stored.
    const payload = toTranscribePayload(state, seeded, true);

    expect(Object.keys(payload.sections).sort()).toEqual(['overrides:alice-id', 'overrides:bob-id']);
    expect(payload.sections['overrides:alice-id']).toEqual({ wins: 0, losses: 0, draws: 0 });
    expect(payload.sections['overrides:bob-id']).toEqual({ wins: 0, losses: 0, draws: 0 });
  });

  it('keys a dirty deck by seat index when the player has no id', () => {
    const state = threePlayerState();
    state.decks[1]!.mainboard = [createCardDetails()];
    state.decks[1]!.dirty = true;

    const payload = toTranscribePayload(state, threePlayerState());

    expect(Object.keys(payload.sections)).toEqual(['decks:1']);
  });

  it('sends only dirty decks, keyed by player id', () => {
    const state = idPlayerState();
    const seeded = idPlayerState();
    const bolt = createCardDetails();
    state.decks[1] = { mainboard: [bolt], sideboard: [], dirty: true, editable: true };

    const payload = toTranscribePayload(state, seeded);

    expect(Object.keys(payload.sections)).toEqual(['decks:bob-id']);
    expect(payload.sections['decks:bob-id']).toEqual({ mainboard: [bolt.oracle_id], sideboard: [] });
  });

  it('includes a dirty deck whose mainboard is empty', () => {
    const state = threePlayerState();
    state.decks[2]!.dirty = true;

    const payload = toTranscribePayload(state, threePlayerState());

    expect(payload.sections['decks:2']).toEqual({ mainboard: [], sideboard: [] });
  });

  it('carries the loaded value as the baseline for each sent section', () => {
    const record = createRecord({
      players: [
        { name: 'Alice', id: 'alice-id' },
        { name: 'Bob', id: 'bob-id' },
      ],
    });
    const { state, seeded } = seedBoth(record);
    state.name = 'Wednesday Night Cube';
    state.overrides = { ...state.overrides, Alice: { wins: 3, losses: 0, draws: 0 } };
    const bolt = createCardDetails();
    state.decks[0] = { mainboard: [bolt], sideboard: [], dirty: true, editable: true };

    const payload = toTranscribePayload(state, seeded);

    expect(payload.baselines.overview).toEqual({
      name: 'Tuesday Night Cube',
      date: 1700000000000,
      description: 'Eight players, three rounds.',
    });
    expect(payload.baselines.overrides).toEqual({ 'alice-id': null });
    expect(payload.baselines.decks).toEqual({ 'alice-id': { mainboard: [], sideboard: [] } });
  });

  it('sends no deck sections for a record whose seats are not editable', () => {
    const playedDraft = createDraft(
      [createCard(), createCard()],
      [
        { mainboard: seatPool(0), sideboard: [] },
        { mainboard: seatPool(1), sideboard: [] },
      ] as Draft['seats'],
      { type: DRAFT_TYPES.DRAFT },
    );
    const record = createRecord();
    const seeded = seedTranscribeState(record, playedDraft);
    const state = seedTranscribeState(record, playedDraft);
    // A seat this record does not own should never carry a dirty flag — setDeckCards already
    // refuses to set one — but the payload builder guards it too, in case one got in anyway.
    state.decks[0] = { ...state.decks[0]!, dirty: true };

    const payload = toTranscribePayload(state, seeded);

    expect(Object.keys(payload.sections).some((key) => key.startsWith('decks:'))).toEqual(false);
  });
});

describe('dirtySections', () => {
  it('returns no keys when nothing changed', () => {
    const record = createRecord();
    const state = seedTranscribeState(record);
    const seeded = seedTranscribeState(record);

    expect(dirtySections(state, seeded, false)).toEqual([]);
  });

  it('returns only the players key when two players swap seats', () => {
    const record = createRecord();
    const state = seedTranscribeState(record);
    const seeded = seedTranscribeState(record);
    // A real reorder moves seatOrder and players together — each player keeps the override
    // and deck seatOrder already carried forward for them, so only the order itself is new.
    state.players = [seeded.players[1]!, seeded.players[0]!];
    state.seatOrder = [1, 0];

    expect(dirtySections(state, seeded, false)).toEqual(['players']);
  });

  // The reviewer's repro for the critical finding: a record with one player's override set
  // and the other's unset, and no pairings — the exact fixture the page opens in records mode
  // for. Before the fix, the baseline for Bob's override was read raw (`null`), while the
  // effective value synthesized a 0-0-0 for him under records mode, reporting a diff for a
  // player nobody has touched the moment the page mounts. Both sides of the comparison must
  // run through the same mode, so passing the (matching) seeded mode here must report nothing.
  it('reports nothing dirty on mount for a record that opens in records mode with an unset override', () => {
    const record = createRecord({ overrides: { Alice: { wins: 3, losses: 0, draws: 0 } }, matches: [] });
    const state = seedTranscribeState(record);
    const seeded = seedTranscribeState(record);

    expect(dirtySections(state, seeded, true, true)).toEqual([]);
  });
});

describe('isDirty', () => {
  const seedBoth = (record: RecordType, draft?: Draft) => ({
    state: seedTranscribeState(record, draft),
    seeded: seedTranscribeState(record, draft),
  });

  it('is false for freshly seeded state', () => {
    const cards = [createCard()];
    const draft = createDraft(cards, [
      { mainboard: seatPool(0), sideboard: [] },
      { mainboard: [], sideboard: [] },
    ] as Draft['seats']);
    const { state, seeded } = seedBoth(createRecord(), draft);

    expect(isDirty(state, seeded)).toEqual(false);
  });

  it('is true after a player is renamed', () => {
    const { state, seeded } = seedBoth(createRecord());
    state.players = [{ name: 'Alicia', userId: 'alice-id' }, { name: 'Bob' }];

    expect(isDirty(state, seeded)).toEqual(true);
  });

  it('is true when any deck is dirty', () => {
    const { state, seeded } = seedBoth(createRecord());
    state.decks[1]!.dirty = true;

    expect(isDirty(state, seeded)).toEqual(true);
  });

  it('is true after a round is added', () => {
    const { state, seeded } = seedBoth(createRecord());
    state.matches = [...state.matches, { matches: [] }];

    expect(isDirty(state, seeded)).toEqual(true);
  });

  it('is true after the overview, seat order, trophies or overrides change', () => {
    const changes: ((state: ReturnType<typeof seedTranscribeState>) => void)[] = [
      (state) => (state.name = 'Renamed event'),
      (state) => (state.date = 1700000000001),
      (state) => (state.description = 'Seven players.'),
      (state) => (state.seatOrder = [1, 0]),
      (state) => (state.trophy = ['Alice', 'Bob']),
      (state) => (state.trophy = []),
      (state) => (state.overrides = { ...state.overrides, Alice: { wins: 3, losses: 0, draws: 0 } }),
      (state) => (state.overrides = { Bob: { wins: 0, losses: 3, draws: 0 } }),
      (state) => (state.overrides = {}),
      (state) => (state.players = [{ name: 'Alice', userId: 'alice-id' }]),
      (state) => (state.players = [{ name: 'Alice' }, { name: 'Bob' }]),
      (state) => (state.matches = [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 0, 0] }] }]),
      (state) => (state.matches = [{ matches: [{ p1: 'Bob', p2: 'Alice', results: [2, 1, 0] }] }]),
      (state) => (state.matches = []),
    ];

    for (const change of changes) {
      const { state, seeded } = seedBoth(createRecord());
      change(state);
      expect(isDirty(state, seeded)).toEqual(true);
    }
  });

  it('ignores the order overrides were entered in', () => {
    const record = createRecord({
      overrides: { Alice: { wins: 1, losses: 0, draws: 0 }, Bob: { wins: 0, losses: 1, draws: 0 } },
    });
    const { state, seeded } = seedBoth(record);
    state.overrides = { Bob: { wins: 0, losses: 1, draws: 0 }, Alice: { wins: 1, losses: 0, draws: 0 } };

    expect(isDirty(state, seeded)).toEqual(false);
  });

  it('treats an override cleared back to undefined as unchanged', () => {
    const { state, seeded } = seedBoth(createRecord({ overrides: {} }));
    state.overrides = { Alice: undefined };

    expect(isDirty(state, seeded)).toEqual(false);
  });

  // Same mount-time repro as the dirtySections test above, but through isDirty, since that is
  // what actually gates the page's Save button and "Unsaved changes" banner.
  it('is false on mount for a record that opens in records mode with an unset override', () => {
    const { state, seeded } = seedBoth(
      createRecord({ overrides: { Alice: { wins: 3, losses: 0, draws: 0 } }, matches: [] }),
    );

    expect(isDirty(state, seeded, true, true)).toEqual(false);
  });
});

describe('areSeatsEditable', () => {
  it('owns the seats with no draft and for an upload draft, but not for any played type', () => {
    const cards = [createCard()];
    const seats = [{ mainboard: seatPool(0), sideboard: [] }] as Draft['seats'];

    expect(areSeatsEditable()).toEqual(true);
    expect(areSeatsEditable(createDraft(cards, seats, { type: DRAFT_TYPES.UPLOAD }))).toEqual(true);

    for (const type of [DRAFT_TYPES.DRAFT, DRAFT_TYPES.GRID, DRAFT_TYPES.SEALED, DRAFT_TYPES.HOUSMAN]) {
      expect(areSeatsEditable(createDraft(cards, seats, { type }))).toEqual(false);
    }
  });
});

describe('setDeckCards', () => {
  const details = (name: string) => createCardDetails({ name, oracle_id: `oracle-${name}` });

  const editableState = () => seedTranscribeState(createRecord());

  // A record backed by a real played draft: the seat pools belong to the draft, not here.
  const playedState = () =>
    seedTranscribeState(
      createRecord(),
      createDraft(
        [createCard(), createCard()],
        [
          { mainboard: seatPool(0), sideboard: [] },
          { mainboard: seatPool(1), sideboard: [] },
        ] as Draft['seats'],
        { type: DRAFT_TYPES.DRAFT },
      ),
    );

  it('writes the board and marks that seat dirty', () => {
    const bolt = details('Lightning Bolt');

    const next = setDeckCards(editableState(), 1, 'mainboard', [bolt]);

    expect(next.decks[1]).toEqual({ mainboard: [bolt], sideboard: [], dirty: true, editable: true });
  });

  it('accepts an updater and hands it the board as it stands', () => {
    const bolt = details('Lightning Bolt');
    const blast = details('Pyroblast');
    const state = setDeckCards(editableState(), 0, 'sideboard', [bolt]);

    const next = setDeckCards(state, 0, 'sideboard', (previous) => [...previous, blast]);

    expect(next.decks[0]!.sideboard).toEqual([bolt, blast]);
  });

  it('leaves every other seat alone', () => {
    const state = editableState();

    const next = setDeckCards(state, 0, 'mainboard', [details('Lightning Bolt')]);

    expect(next.decks[1]).toBe(state.decks[1]);
    expect(next.decks[1]!.dirty).toEqual(false);
  });

  // Constraint 1. A single dirty flag on a played draft's seat makes the endpoint reject the
  // whole save — overview and pairings included — so the refusal has to be in the reducer,
  // not only in what the decks section chooses to render.
  it('refuses an update for a seat the record does not own, and sets no dirty flag', () => {
    const state = playedState();

    const next = setDeckCards(state, 0, 'mainboard', [details('Lightning Bolt')]);

    expect(next).toBe(state);
    expect(next.decks[0]!.dirty).toEqual(false);
    expect(toTranscribePayload(next, next).sections).toEqual({});
  });

  it('refuses an updater for a seat the record does not own without ever calling it', () => {
    const state = playedState();
    const update = jest.fn(() => [details('Lightning Bolt')]);

    const next = setDeckCards(state, 1, 'sideboard', update);

    expect(update).not.toHaveBeenCalled();
    expect(next).toBe(state);
  });

  it('refuses an update for a seat that does not exist', () => {
    const state = editableState();

    const next = setDeckCards(state, 7, 'mainboard', [details('Lightning Bolt')]);

    expect(next).toBe(state);
    expect(next.decks[7]).toBeUndefined();
  });
});

describe('applyPlayerEdit', () => {
  const threePlayers = () =>
    seedTranscribeState(
      createRecord({
        players: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }],
        matches: [
          {
            matches: [
              { p1: 'Alice', p2: 'Bob', results: [2, 1, 0] },
              { p1: 'Carol', p2: 'Alice', results: [0, 2, 0] },
            ],
          },
        ],
        trophy: ['Carol'],
        overrides: { Alice: { wins: 2, losses: 1, draws: 0 }, Carol: { wins: 1, losses: 2, draws: 0 } },
      }),
    );

  it('re-keys matches, trophy and overrides through a rename', () => {
    const state = threePlayers();

    const next = applyPlayerEdit(state, [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Caroline' }], [0, 1, 2], true);

    expect(next.matches[0]!.matches[1]!.p1).toEqual('Caroline');
    expect(next.trophy).toEqual(['Caroline']);
    expect(next.overrides).toEqual({
      Alice: { wins: 2, losses: 1, draws: 0 },
      Caroline: { wins: 1, losses: 2, draws: 0 },
    });
    expect(next.seatOrder).toEqual([0, 1, 2]);
  });

  it('resolves a straight two-name swap against the originals', () => {
    const state = threePlayers();

    const next = applyPlayerEdit(state, [{ name: 'Bob' }, { name: 'Alice' }, { name: 'Carol' }], [0, 1, 2], true);

    // Seat 0 is now called Bob and seat 1 Alice, so the round they played reads Bob vs Alice
    // — not Alice vs Alice, which a rename applied one key at a time would produce.
    expect(next.matches[0]!.matches[0]).toEqual({ p1: 'Bob', p2: 'Alice', results: [2, 1, 0] });
    expect(next.overrides).toEqual({
      Bob: { wins: 2, losses: 1, draws: 0 },
      Carol: { wins: 1, losses: 2, draws: 0 },
    });
  });

  it('drops the trophy and override of a player removed in the same edit', () => {
    const state = threePlayers();

    const next = applyPlayerEdit(state, [{ name: 'Alice' }, { name: 'Bob' }], [0, 1], true);

    expect(next.trophy).toEqual([]);
    expect(Object.keys(next.overrides)).toEqual(['Alice']);
    expect(next.seatOrder).toEqual([0, 1]);
  });

  it('carries each player to the draft seat they came from when reordered', () => {
    const state = threePlayers();

    const next = applyPlayerEdit(state, [{ name: 'Carol' }, { name: 'Alice' }, { name: 'Bob' }], [2, 0, 1], true);

    expect(next.players.map((player) => player.name)).toEqual(['Carol', 'Alice', 'Bob']);
    expect(next.seatOrder).toEqual([2, 0, 1]);
  });

  it('composes a second reorder against the seats the first one left behind', () => {
    const once = applyPlayerEdit(
      threePlayers(),
      [{ name: 'Carol' }, { name: 'Alice' }, { name: 'Bob' }],
      [2, 0, 1],
      true,
    );

    const twice = applyPlayerEdit(once, [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }], [1, 2, 0], true);

    expect(twice.seatOrder).toEqual([0, 1, 2]);
  });

  it('gives a player added in this edit a fresh seat and an empty deck', () => {
    const state = threePlayers();

    const next = applyPlayerEdit(
      state,
      [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }, { name: 'Dave' }],
      [0, 1, 2, -1],
      true,
    );

    expect(next.seatOrder).toEqual([0, 1, 2, -1]);
    expect(next.decks[3]).toEqual({ mainboard: [], sideboard: [], dirty: false, editable: true });
  });

  it('moves a seat deck with its player', () => {
    const state = threePlayers();
    const bolt = createCardDetails({ name: 'Lightning Bolt', oracle_id: 'oracle-bolt' });
    const edited = setDeckCards(state, 2, 'mainboard', [bolt]);

    const next = applyPlayerEdit(edited, [{ name: 'Carol' }, { name: 'Alice' }, { name: 'Bob' }], [2, 0, 1], true);

    expect(next.decks[0]!.mainboard).toEqual([bolt]);
    expect(next.decks[0]!.dirty).toEqual(true);
    expect(next.decks[1]!.mainboard).toEqual([]);
  });

  it('marks a fresh seat not editable when the record does not own its seats', () => {
    const state = threePlayers();

    const next = applyPlayerEdit(state, [...state.players, { name: 'Dave' }], [0, 1, 2, -1], false);

    expect(next.decks[3]!.editable).toEqual(false);
  });
});

describe('validationErrors', () => {
  const details = () => createCardDetails();

  const withPlayers = (count: number): TranscribeState =>
    seedTranscribeState(
      createRecord({
        players: Array.from({ length: count }, (_, index) => ({ name: `Player ${index + 1}` })),
        matches: [],
        trophy: [],
        overrides: {},
      }),
    );

  const withRounds = (count: number): TranscribeState =>
    seedTranscribeState(
      createRecord({ matches: Array.from({ length: count }, () => ({ matches: [] })), trophy: [], overrides: {} }),
    );

  const withDeck = (board: 'mainboard' | 'sideboard', size: number, dirty: boolean): TranscribeState => {
    const state = seedTranscribeState(createRecord());
    state.decks[0] = {
      mainboard: [],
      sideboard: [],
      [board]: Array.from({ length: size }, details),
      dirty,
      editable: true,
    } as TranscribeState['decks'][number];
    return state;
  };

  it('passes a freshly seeded record', () => {
    expect(validationErrors(seedTranscribeState(createRecord()))).toEqual([]);
  });

  it('requires a name', () => {
    const state = seedTranscribeState(createRecord());
    state.name = '   ';

    expect(validationErrors(state)).toEqual(['Give this record a name.']);
  });

  // EditDescription reports a cleared date field as undefined, which the page keeps as NaN
  // rather than falling back to a number that would silently date the record to the epoch.
  it('requires a date, and treats a cleared one as missing', () => {
    const state = seedTranscribeState(createRecord());
    state.date = NaN;

    expect(validationErrors(state)).toEqual(['Give this record a date.']);
  });

  it.each([
    [MAX_NAME_LENGTH - 1, false],
    [MAX_NAME_LENGTH, false],
    [MAX_NAME_LENGTH + 1, true],
  ])('reports a %i-character name as over the cap: %s', (length, expected) => {
    const state = seedTranscribeState(createRecord({ name: 'n'.repeat(length) }));

    expect(validationErrors(state)).toEqual(
      expected ? [`A record name is at most ${MAX_NAME_LENGTH} characters, and this one has ${length}.`] : [],
    );
  });

  // The file importer accepts a description of up to 5000 characters, so a record can arrive
  // already past this endpoint's cap. Without this check the only way to find out is a raw
  // Joi message in the footer, after a whole event has been typed out.
  it.each([
    [MAX_DESCRIPTION_LENGTH - 1, false],
    [MAX_DESCRIPTION_LENGTH, false],
    [MAX_DESCRIPTION_LENGTH + 1, true],
  ])('reports a %i-character description as over the cap: %s', (length, expected) => {
    const state = seedTranscribeState(createRecord({ description: 'd'.repeat(length) }));

    expect(validationErrors(state)).toEqual(
      expected
        ? [`A record description is at most ${MAX_DESCRIPTION_LENGTH} characters, and this one has ${length}.`]
        : [],
    );
  });

  it.each([
    [MAX_PLAYERS - 1, false],
    [MAX_PLAYERS, false],
    [MAX_PLAYERS + 1, true],
  ])('reports %i players as over the cap: %s', (count, expected) => {
    const errors = validationErrors(withPlayers(count));

    expect(errors.some((error) => error.includes(`at most ${MAX_PLAYERS} players`))).toEqual(expected);
  });

  it.each([
    [MAX_ROUNDS - 1, false],
    [MAX_ROUNDS, false],
    [MAX_ROUNDS + 1, true],
  ])('reports %i rounds as over the cap: %s', (count, expected) => {
    const errors = validationErrors(withRounds(count));

    expect(errors.some((error) => error.includes(`at most ${MAX_ROUNDS} rounds`))).toEqual(expected);
  });

  // The endpoint keys matches, trophies and overrides by name, so two players sharing one is
  // not merely a Joi .unique('name') violation — their results would be indistinguishable.
  it.each([
    [['Alice', 'Bob'], []],
    [['Alice', 'Alice'], ['Alice']],
    [['Alice', 'alice'], ['alice']],
    [
      ['Alice', 'Bob', 'ALICE', 'Bob'],
      ['ALICE', 'Bob'],
    ],
  ])('reports %j as the duplicates %j', (names, duplicates) => {
    const state = seedTranscribeState(createRecord({ players: names.map((name) => ({ name })), matches: [] }));

    const reported = validationErrors(state).filter((error) => error.startsWith('Two players cannot share a name'));

    expect(reported).toEqual(
      duplicates.length === 0 ? [] : [`Two players cannot share a name: ${duplicates.join(', ')}.`],
    );
  });

  it.each([
    ['mainboard' as const, MAX_DECK_CARDS, false],
    ['mainboard' as const, MAX_DECK_CARDS + 1, true],
    ['sideboard' as const, MAX_DECK_CARDS, false],
    ['sideboard' as const, MAX_DECK_CARDS + 1, true],
  ])('reports a dirty %s of %i cards as over the cap: %s', (board, size, expected) => {
    const errors = validationErrors(withDeck(board, size, true));

    expect(errors).toEqual(expected ? [`Alice's ${board} has ${size} cards, over the ${MAX_DECK_CARDS} limit.`] : []);
  });

  // Only a dirty deck is submitted, so only a dirty deck can be rejected for its size — an
  // oversized seat the user never touched is the server's existing data, not a new 400.
  it('ignores an oversized deck that was never edited', () => {
    expect(validationErrors(withDeck('mainboard', MAX_DECK_CARDS + 50, false))).toEqual([]);
  });

  it('names an oversized deck by its seat when the player list has moved on', () => {
    const state = withDeck('mainboard', MAX_DECK_CARDS + 1, true);
    state.players = [];

    expect(validationErrors(state)).toEqual([
      `Seat 1's mainboard has ${MAX_DECK_CARDS + 1} cards, over the ${MAX_DECK_CARDS} limit.`,
    ]);
  });
});

// Pastes are not part of TranscribeState — they are what the user is still typing — but they
// have to follow their player through a reorder the same way applyPlayerEdit moves the decks,
// or a half-entered decklist ends up under somebody else's name.
describe('movePastes', () => {
  const pastes = {
    0: { text: "Alice's list", errors: ['Could not find card: "Notacard"'] },
    1: { text: "Bob's list", errors: [] },
  };

  it("carries each paste to its player's new position", () => {
    expect(movePastes(pastes, [1, 0])).toEqual({ 0: pastes[1], 1: pastes[0] });
  });

  it('gives a newly added player an empty box', () => {
    expect(movePastes(pastes, [0, -1, 1])).toEqual({ 0: pastes[0], 2: pastes[1] });
  });

  it('drops the paste of a player who was removed', () => {
    expect(movePastes(pastes, [1])).toEqual({ 0: pastes[1] });
  });

  it('leaves an untouched list exactly as it was', () => {
    expect(movePastes(pastes, [0, 1])).toEqual(pastes);
  });
});

describe('resolvePlayerIndex', () => {
  it('resolves a digit suffix as a seat position', () => {
    expect(resolvePlayerIndex('2', [{ name: 'A' }, { name: 'B' }, { name: 'C', id: '99' }])).toBe(2);
  });

  it('resolves a non-digit suffix as a player id', () => {
    expect(resolvePlayerIndex('abc', [{ name: 'A', id: 'abc' }, { name: 'B' }])).toBe(0);
  });

  it('reports -1 for an id this list no longer has', () => {
    expect(resolvePlayerIndex('gone', [{ name: 'A', id: 'abc' }])).toBe(-1);
  });
});

// The post-save reconciliation this workspace uses once the endpoint names which sections it
// actually wrote: seeded is re-based section by section from `record` — the server's echo —
// never from what this workspace submitted, since the server may have minted a player id,
// rebased a renamed player's matches or trophy, or resolved a brand new player's override.
describe('reconcileAfterSave', () => {
  it('re-baselines overview from the response, not from state', () => {
    const seeded = seedTranscribeState(createRecord({ name: 'Original' }));
    const edited: TranscribeState = { ...seeded, name: 'Typed by me' };
    const record: SectionBaselines = {
      overview: { name: 'Normalized by the server', date: seeded.date, description: seeded.description },
    };

    const result = reconcileAfterSave(edited, seeded, ['overview'], record);

    expect(result.seeded.name).toBe('Normalized by the server');
    // Applying a section never touches `state` beyond what the section itself requires
    // (seatOrder for players, a deck's dirty flag) — the user's own typing stays exactly as
    // they left it.
    expect(result.state.name).toBe('Typed by me');
  });

  it('re-baselines players, and forces identity seatOrder on both sides, from the response rather than the submitted permutation', () => {
    const seeded = seedTranscribeState(createRecord({ players: [{ name: 'Alice' }, { name: 'Bob' }] }));
    // The user reordered locally — [1, 0] is what was actually submitted.
    const edited: TranscribeState = {
      ...seeded,
      players: [{ name: 'Bob' }, { name: 'Alice' }],
      seatOrder: [1, 0],
    };
    const record: SectionBaselines = {
      players: {
        players: [
          { id: 'srv-bob', name: 'Bob' },
          { id: 'srv-alice', name: 'Alice' },
        ],
        seatOrder: [0, 1],
      },
    };

    const result = reconcileAfterSave(edited, seeded, ['players'], record);

    expect(result.seeded.players).toEqual(record.players!.players);
    expect(result.seeded.seatOrder).toEqual([0, 1]);
    expect(result.state.seatOrder).toEqual([0, 1]);
  });

  it("re-keys seeded.decks from old positions to new ones when a pure seat reorder applies, so a player whose deck wasn't submitted keeps addressing their own stored deck", () => {
    const aliceDeckCard = createCardDetails({ name: 'Alice Card', oracle_id: 'oracle-alice' });
    const bobDeckCard = createCardDetails({ name: 'Bob Card', oracle_id: 'oracle-bob' });
    const seeded: TranscribeState = {
      ...seedTranscribeState(createRecord({ players: [{ name: 'Alice' }, { name: 'Bob' }], overrides: {} })),
      decks: {
        0: { mainboard: [aliceDeckCard], sideboard: [], dirty: false, editable: true },
        1: { mainboard: [bobDeckCard], sideboard: [], dirty: false, editable: true },
      },
    };
    // The user reordered locally (Bob first) without touching either deck this save.
    const edited: TranscribeState = {
      ...seeded,
      players: [{ name: 'Bob' }, { name: 'Alice' }],
      seatOrder: [1, 0],
    };
    const record: SectionBaselines = {
      players: {
        players: [
          { id: 'srv-bob', name: 'Bob' },
          { id: 'srv-alice', name: 'Alice' },
        ],
        seatOrder: [0, 1],
      },
    };

    const result = reconcileAfterSave(edited, seeded, ['players'], record);

    // Bob is now at position 0 and must keep addressing his own stored deck there — not
    // Alice's, which the unfixed code left behind at index 0.
    expect(result.seeded.decks[0]?.mainboard).toEqual([bobDeckCard]);
    expect(result.seeded.decks[1]?.mainboard).toEqual([aliceDeckCard]);

    // The anti-goal this guards: editing Bob's deck afterward (still not submitted) must
    // diff and submit against his own stored deck, not Alice's — a spurious conflict on a
    // section nobody but this user touched.
    const afterDeckEdit: TranscribeState = {
      ...result.state,
      decks: {
        ...result.state.decks,
        0: { ...result.state.decks[0], mainboard: [bobDeckCard, aliceDeckCard], dirty: true },
      },
    };
    const payload = toTranscribePayload(afterDeckEdit, result.seeded);
    expect(payload.baselines.decks?.['0']).toEqual({ mainboard: ['oracle-bob'], sideboard: [] });
  });

  it("reuses the deck's own CardDetails when its section applies, rather than rebuilding degraded stand-ins from the response's oracle-id echo", () => {
    const seeded = seedTranscribeState(createRecord());
    const bolt = createCardDetails({ name: 'Lightning Bolt', oracle_id: 'oracle-bolt' });
    const edited: TranscribeState = {
      ...seeded,
      decks: { ...seeded.decks, 0: { mainboard: [bolt], sideboard: [], dirty: true, editable: true } },
    };
    const record: SectionBaselines = { decks: { '0': { mainboard: ['oracle-bolt'], sideboard: [] } } };

    const result = reconcileAfterSave(edited, seeded, ['decks:0'], record);

    expect(result.state.decks[0]).toEqual({ mainboard: [bolt], sideboard: [], dirty: false, editable: true });
    expect(result.seeded.decks[0]).toEqual({ mainboard: [bolt], sideboard: [], dirty: false, editable: true });
  });

  it('leaves a section out of `applied` exactly as the user had it', () => {
    const seeded = seedTranscribeState(createRecord({ trophy: ['Alice'] }));
    const edited: TranscribeState = { ...seeded, trophy: ['Alice', 'Bob'] };

    const result = reconcileAfterSave(edited, seeded, [], {});

    expect(result.state.trophy).toEqual(['Alice', 'Bob']);
    expect(result.seeded.trophy).toEqual(['Alice']);
  });

  it('resolves a digit-keyed override through the seat it points at, not the position it shares with state, when players itself did not apply', () => {
    const seeded = seedTranscribeState(createRecord({ players: [{ name: 'Alice' }, { name: 'Bob' }], overrides: {} }));
    // Reordered locally but not (yet) saved: state's position 0 is Bob, who came from
    // seeded's position 1 (seatOrder[0] === 1). A position-for-position copy would
    // mis-attribute this to seeded's own Alice instead.
    const edited: TranscribeState = {
      ...seeded,
      players: [{ name: 'Bob' }, { name: 'Alice' }],
      seatOrder: [1, 0],
      overrides: { Bob: { wins: 2, losses: 0, draws: 0 } },
    };
    const record: SectionBaselines = { overrides: { '0': { wins: 2, losses: 0, draws: 0 } } };

    const result = reconcileAfterSave(edited, seeded, ['overrides:0'], record);

    expect(result.seeded.overrides).toEqual({ Bob: { wins: 2, losses: 0, draws: 0 } });
  });
});

describe('fallbackRecord', () => {
  it('treats a response with no record as having echoed back exactly what was submitted, forcing identity seatOrder for players', () => {
    const seeded = seedTranscribeState(createRecord({ players: [{ name: 'Alice' }, { name: 'Bob' }] }));
    const edited: TranscribeState = {
      ...seeded,
      name: 'Renamed Night',
      players: [{ name: 'Bob' }, { name: 'Alice' }],
      seatOrder: [1, 0],
    };

    const payload = toTranscribePayload(edited, seeded);
    const record = fallbackRecord(payload.sections);

    expect(record.overview).toEqual({ name: 'Renamed Night', date: seeded.date, description: seeded.description });
    expect(record.players).toEqual({ players: [{ name: 'Bob' }, { name: 'Alice' }], seatOrder: [0, 1] });
  });
});

describe('keepStoredSection', () => {
  it("discards the local edit outright — both sides take the server's current value", () => {
    const seeded = seedTranscribeState(createRecord({ name: 'Original' }));
    const state: TranscribeState = { ...seeded, name: 'My edit' };
    const conflict: SaveConflict = {
      section: 'overview',
      stored: { name: "Someone else's edit", date: seeded.date, description: seeded.description },
    };

    const result = keepStoredSection(state, seeded, conflict);

    expect(result.state.name).toBe("Someone else's edit");
    expect(result.seeded.name).toBe("Someone else's edit");
  });

  it('rebuilds a conflicted deck from the stored oracle ids as a placeholder, clearing dirty', () => {
    const seeded = seedTranscribeState(createRecord());
    const bolt = createCardDetails({ name: 'Lightning Bolt', oracle_id: 'oracle-bolt' });
    const state: TranscribeState = {
      ...seeded,
      decks: { ...seeded.decks, 0: { mainboard: [bolt], sideboard: [], dirty: true, editable: true } },
    };
    const conflict: SaveConflict = { section: 'decks:0', stored: { mainboard: ['oracle-other'], sideboard: [] } };

    const result = keepStoredSection(state, seeded, conflict);

    expect(result.state.decks[0]!.dirty).toBe(false);
    expect(result.state.decks[0]!.mainboard.map((card) => card.oracle_id)).toEqual(['oracle-other']);
    expect(result.seeded.decks[0]!.mainboard.map((card) => card.oracle_id)).toEqual(['oracle-other']);
  });

  it('resolves an id-keyed override conflict against each side independently', () => {
    const seeded = seedTranscribeState(
      createRecord({
        players: [
          { name: 'Alice', id: 'alice-id' },
          { name: 'Bob', id: 'bob-id' },
        ],
        overrides: {},
      }),
    );
    const state: TranscribeState = { ...seeded, overrides: { Alice: { wins: 9, losses: 0, draws: 0 } } };
    const conflict: SaveConflict = { section: 'overrides:alice-id', stored: { wins: 1, losses: 1, draws: 1 } };

    const result = keepStoredSection(state, seeded, conflict);

    expect(result.state.overrides).toEqual({ Alice: { wins: 1, losses: 1, draws: 1 } });
    expect(result.seeded.overrides).toEqual({ Alice: { wins: 1, losses: 1, draws: 1 } });
  });
});

describe('keepLocalSection', () => {
  it('moves only the baseline — the local edit survives untouched and stays dirty', () => {
    const seeded = seedTranscribeState(createRecord({ name: 'Original' }));
    const state: TranscribeState = { ...seeded, name: 'My edit' };
    const conflict: SaveConflict = {
      section: 'overview',
      stored: { name: "Someone else's edit", date: seeded.date, description: seeded.description },
    };

    const nextSeeded = keepLocalSection(state, seeded, conflict);

    expect(nextSeeded.name).toBe("Someone else's edit");
    // The next diff would compare this against `state`, which the caller leaves untouched —
    // "My edit" against this new baseline reads dirty again, which is what lets the next
    // Save resubmit and overwrite rather than silently reapplying what was just rejected.
    expect(dirtySections(state, nextSeeded, false)).toContain('overview');
  });
});
