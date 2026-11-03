import Card from '@utils/datatypes/Card';
import Draft, { DRAFT_TYPES } from '@utils/datatypes/Draft';
import RecordType from '@utils/datatypes/Record';

import { createCard, createCardDetails, createCardWithoutDetails } from '../../../server/test/test-utils/data';
import {
  applyPlayerEdit,
  areSeatsEditable,
  isDirty,
  MAX_DECK_CARDS,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MAX_ROUNDS,
  movePastes,
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

  it('includes only dirty decks', () => {
    const state = threePlayerState();
    state.decks[1]!.mainboard = [createCardDetails()];
    state.decks[1]!.dirty = true;

    const payload = toTranscribePayload(state);

    expect(Object.keys(payload.decks)).toEqual(['2']);
  });

  it('keys decks 1-based', () => {
    const state = threePlayerState();
    const first = createCardDetails();
    const third = createCardDetails();
    state.decks[0] = { mainboard: [first], sideboard: [], dirty: true, editable: true };
    state.decks[2] = { mainboard: [third], sideboard: [], dirty: true, editable: true };

    const payload = toTranscribePayload(state);

    expect(Object.keys(payload.decks)).toEqual(['1', '3']);
    expect(payload.decks[1]!.mainboard).toEqual([first.oracle_id]);
    expect(payload.decks[3]!.mainboard).toEqual([third.oracle_id]);
  });

  it('maps card details to oracle ids', () => {
    const state = threePlayerState();
    const main = [createCardDetails(), createCardDetails()];
    const side = [createCardDetails()];
    state.decks[0] = { mainboard: main, sideboard: side, dirty: true, editable: true };

    const payload = toTranscribePayload(state);

    expect(payload.decks[1]).toEqual({
      mainboard: [main[0]!.oracle_id, main[1]!.oracle_id],
      sideboard: [side[0]!.oracle_id],
    });
  });

  it('includes a dirty deck whose mainboard is empty', () => {
    const state = threePlayerState();
    state.decks[2]!.dirty = true;

    const payload = toTranscribePayload(state);

    expect(payload.decks[3]).toEqual({ mainboard: [], sideboard: [] });
  });

  it('omits overrides whose value is undefined', () => {
    const state = threePlayerState();
    state.overrides = {
      Alice: { wins: 2, losses: 0, draws: 1 },
      Bob: undefined,
      Carol: { wins: 0, losses: 2, draws: 0 },
    };

    const payload = toTranscribePayload(state);

    expect(Object.keys(payload.overrides)).toEqual(['Alice', 'Carol']);
    expect(payload.overrides).toEqual({
      Alice: { wins: 2, losses: 0, draws: 1 },
      Carol: { wins: 0, losses: 2, draws: 0 },
    });
  });

  it('carries seatOrder through unchanged', () => {
    const state = threePlayerState();
    state.seatOrder = [2, -1, 0];

    const payload = toTranscribePayload(state);

    expect(payload.seatOrder).toEqual([2, -1, 0]);
    expect(payload.seatOrder.length).toEqual(payload.players.length);
  });

  it('carries the overview, players, matches and trophies through unchanged', () => {
    const state = seedTranscribeState(createRecord());

    const payload = toTranscribePayload(state);

    expect(payload).toEqual({
      name: 'Tuesday Night Cube',
      date: 1700000000000,
      description: 'Eight players, three rounds.',
      players: [{ name: 'Alice', userId: 'alice-id' }, { name: 'Bob' }],
      seatOrder: [0, 1],
      matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] }] }],
      overrides: { Bob: { wins: 1, losses: 2, draws: 0 } },
      trophy: ['Alice'],
      decks: {},
    });
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
    expect(toTranscribePayload(next).decks).toEqual({});
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
