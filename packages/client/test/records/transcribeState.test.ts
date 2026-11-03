import Card from '@utils/datatypes/Card';
import Draft, { DRAFT_TYPES } from '@utils/datatypes/Draft';
import RecordType from '@utils/datatypes/Record';

import { createCard, createCardDetails, createCardWithoutDetails } from '../../../server/test/test-utils/data';
import { isDirty, seedTranscribeState, toTranscribePayload } from '../../src/records/transcribe/transcribeState';

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
