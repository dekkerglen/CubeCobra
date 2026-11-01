import Card from '@utils/datatypes/Card';
import Draft, { DraftStep, LoreSeekerPack } from '@utils/datatypes/Draft';
import { DRAFT_EFFECTS } from '@utils/drafting/draftEffects';
import {
  actingSeats,
  applyChoice,
  applyTick,
  botArms,
  botChoice,
  botDecision,
  createEngineState,
  DraftLogEntry,
  engineContext,
  EngineState,
  seatCardActions,
  SeatDecision,
} from '@utils/drafting/draftEngine';
import { getSeatActionStates } from '@utils/draftutil';

import { handler as finishDraftHandler, validateBody } from '../../../src/router/routes/draft/finish';
import { createCard, createCompletedSoloDraft, createUser } from '../../test-utils/data';
import { call, middleware } from '../../test-utils/transport';

jest.mock('serverutils/util', () => ({
  addNotification: jest.fn(),
}));

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
  },
  draftDao: {
    getById: jest.fn(),
    update: jest.fn(),
    markBotDecksPending: jest.fn(),
    markBotDecksFailed: jest.fn(),
  },
}));

import { draftDao } from '../../../src/dynamo/daos';

jest.mock('serverutils/deckbuildQueue', () => ({
  publishBotDeckBuild: jest.fn(),
}));

jest.mock('serverutils/deckbuildJob', () => ({
  buildDeckbuildJob: jest.fn(() => ({ draftId: 'draft', seats: [], basics: [], facts: {} })),
  writeDeckbuildJob: jest.fn(),
}));

const SEATS = 8;
const ROUNDS = 3;
const PACK = 15;
const LORE_PACKS = 3;

const oracleOf = Object.fromEntries(Object.entries(DRAFT_EFFECTS).map(([oracle, effect]) => [effect.name, oracle]));

// Placed early in the first packs, so the effects come up while there's draft left to use them.
const EFFECT_CARDS = [
  'Cogwork Librarian',
  "Leovold's Operative",
  'Agent of Acquisitions',
  'Archdemon of Paliano',
  'Cogwork Grinder',
  'Animus of Predation',
  'Canal Dredger',
  'Canal Dredger',
  'Garbage Fire',
  'Cogwork Tracker',
  'Aether Searcher',
  'Noble Banneret',
  'Paliano, the High City',
  'Cogwork Spy',
  'Spire Phantasm',
  'Lore Seeker',
  'Lore Seeker',
];

const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

// Pick, pass, pick, ... and the last round opens with a trash (not the last card, which
// a Canal Dredger would take).
const packSteps = (round: number): DraftStep[] => {
  const steps: DraftStep[] = [];
  for (let i = 0; i < PACK; i += 1) {
    if (i > 0) steps.push({ action: 'pass', amount: null });
    steps.push({ action: round === ROUNDS - 1 && i === 0 ? 'trash' : 'pick', amount: 1 });
  }
  return steps;
};

const buildDraft = (): Draft => {
  const total = SEATS * ROUNDS * PACK + LORE_PACKS * PACK;
  const cards: Card[] = Array.from({ length: total }, (_, index) => {
    const card = createCard();
    card.details = {
      ...card.details!,
      type: index % 3 === 0 ? 'Creature — Elf Warrior' : 'Instant',
      colors: [['W', 'U', 'B', 'R', 'G'][index % 5]!] as any,
      keywords: index % 4 === 0 ? ['Flying'] : [],
    };
    return card;
  });
  EFFECT_CARDS.forEach((name, k) => {
    // Seat k % SEATS, round 0, slot k / SEATS.
    const index = (k % SEATS) * PACK + Math.floor(k / SEATS);
    cards[index]!.details = { ...cards[index]!.details!, oracle_id: oracleOf[name]!, name, type: 'Artifact Creature' };
  });
  const InitialState = Array.from({ length: SEATS }, (_, seat) =>
    Array.from({ length: ROUNDS }, (_, round) => ({
      cards: Array.from({ length: PACK }, (_, k) => round * SEATS * PACK + seat * PACK + k),
      steps: packSteps(round),
    })),
  );
  let next = SEATS * ROUNDS * PACK;
  const LoreSeekerPacks: LoreSeekerPack[] = [];
  cards.forEach((card, index) => {
    if (card.details?.name === 'Lore Seeker' && next + PACK <= total) {
      LoreSeekerPacks.push({ source: index, cards: Array.from({ length: PACK }, (_, k) => next + k), steps: [] });
      next += PACK;
    }
  });
  const base = createCompletedSoloDraft();
  return {
    ...base,
    cards,
    InitialState,
    LoreSeekerPacks,
    basics: [],
    seats: Array.from({ length: SEATS }, (_, seat) => ({
      ...base.seats[seat === 0 ? 0 : 1]!,
      mainboard: [[[]]],
      sideboard: [[[]]],
    })),
  };
};

// Every seat played by the bots, the way the draft page runs them: choices first, then
// arming, then one decision per acting seat.
const runDraft = (draft: Draft, seed: number): EngineState => {
  const rng = seeded(seed);
  const ctx = engineContext(draft);
  let state = createEngineState(SEATS, ctx);
  for (let guard = 0; !state.done && guard < 2000; guard += 1) {
    while (state.choices.length > 0) {
      let answered = false;
      for (let seat = 0; seat < SEATS && !answered; seat += 1) {
        const entry = botChoice(state, seat, ctx, rng);
        if (entry) {
          state = applyChoice(state, entry, ctx).state;
          answered = true;
        }
      }
      if (!answered) throw new Error('nobody answers a pending choice');
    }
    for (let seat = 0; seat < SEATS; seat += 1) {
      for (const arm of botArms(state, seat, ctx)) state = applyChoice(state, arm, ctx).state;
    }
    if (state.done) break;
    const decisions: Record<number, SeatDecision> = {};
    for (const seat of actingSeats(state)) {
      const pack = state.packs[state.seats[seat]!.queue[0]!]!;
      const ratings = new Map(pack.cards.map((card) => [card, rng()]));
      decisions[seat] = botDecision(state, seat, ctx, ratings, rng)!;
    }
    state = applyTick(state, decisions, ctx).state;
  }
  if (!state.done) throw new Error('the draft did not finish');
  return state;
};

// What an old client would send; with a log, the server ignores it.
const legacyBody = {
  state: { seats: [{ picks: [1, 2, 3], trashed: [4], pack: [] }], pack: 1, pick: 1 },
  mainboard: [[[1], [2]]],
  sideboard: [[[3]]],
};

describe('Finishing a draft with a decision log', () => {
  const owner = createUser();
  const draft = buildDraft();
  const final = runDraft(draft, 7);
  const log: DraftLogEntry[] = final.log;

  const finish = async (body: Record<string, unknown>) => {
    const stored: Draft = JSON.parse(JSON.stringify({ ...draft, owner, cubeOwner: owner }));
    (draftDao.getById as jest.Mock).mockResolvedValue(stored);
    (draftDao.update as jest.Mock).mockResolvedValue(stored.id);
    const res = await call(finishDraftHandler)
      .as(owner)
      .withParams({ id: stored.id })
      .withBody({ ...legacyBody, ...body })
      .send();
    expect(res.status).toBe(200);
    return (draftDao.update as jest.Mock).mock.calls[0]![0] as Draft;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BOT_DECKBUILD_TOPIC_ARN = 'arn:aws:sns:us-east-2:000000000000:bot-deckbuild-test';
  });

  afterEach(() => {
    delete process.env.BOT_DECKBUILD_TOPIC_ARN;
  });

  it('exercises the draft-matters effects', () => {
    // Guards the fixture: if the bots stop using these, the tests below stop covering them.
    const actions = final.seats.map((_, seat) => seatCardActions({ ...draft, DraftLog: log }, seat)).flat();
    const vias = new Set(actions.map((action) => action.via));
    for (const via of ['pick', 'extra', 'trash', 'removed', 'received', 'blind', 'takeAll']) {
      expect([...vias]).toContain(via);
    }
    expect(final.loreUsed.length).toBeGreaterThan(0);
    expect(final.seats.some((seat) => Object.keys(seat.notes).length > 0)).toBe(true);
  });

  it('stores what the replayed log says each seat drafted, trashed and removed', async () => {
    const saved = await finish({ log });

    final.seats.forEach((engineSeat, index) => {
      const seat = saved.seats[index]!;
      expect(seat.pickorder).toEqual(engineSeat.pool.slice().reverse());
      expect(seat.trashorder).toEqual(engineSeat.trashed.slice().reverse());
      expect(seat.removedorder).toEqual(engineSeat.removed.slice().reverse());
      expect(seat.draftNotes).toEqual(engineSeat.notes);
    });
    expect(saved.DraftLog).toEqual(log);
    // The player's own deck is still what they submitted.
    expect(saved.seats[0]!.mainboard).toEqual(legacyBody.mainboard);
  });

  it('gives the pick breakdown every card each seat ended up with', async () => {
    const saved = await finish({ log });

    final.seats.forEach((engineSeat, index) => {
      const actions = seatCardActions(saved, index);
      const drafted = actions.filter((action) => action.action === 'pick' && action.via !== 'removed');
      for (const card of engineSeat.pool) {
        expect(drafted.map((action) => action.selection)).toContain(card);
      }
      expect(actions.filter((action) => action.via === 'trash').map((action) => action.selection)).toEqual(
        engineSeat.trashed,
      );
      expect(actions.filter((action) => action.via === 'removed').map((action) => action.selection)).toEqual(
        engineSeat.removed,
      );
      // Each card came out of the pack it was shown in.
      for (const action of actions) expect(action.cardsInPack).toContain(action.selection);
      expect(getSeatActionStates(saved, index)).toHaveLength(actions.length);
    });
  });

  it('falls back to the submitted picks when the log stops before the draft ends', async () => {
    const saved = await finish({ log: log.slice(0, Math.floor(log.length / 2)) });

    expect(saved.seats[0]!.pickorder).toEqual(legacyBody.state.seats[0]!.picks);
    expect(saved.seats[0]!.trashorder).toEqual(legacyBody.state.seats[0]!.trashed);
    expect(saved.DraftLog).toBeUndefined();
  });

  // A tampered log: the first tick's decisions for every seat replaced.
  const tamper = (replace: (seat: number, decision: SeatDecision) => SeatDecision) =>
    log.map((entry) =>
      entry.t === 0 && 'd' in entry
        ? {
            ...entry,
            d: Object.fromEntries(
              Object.entries(entry.d).map(([seat, decision]) => [seat, replace(Number(seat), decision)]),
            ),
          }
        : entry,
    );

  it('does not accept picks of cards that are not in the pack', async () => {
    // Cards from packs nobody has opened yet.
    const saved = await finish({
      log: tamper((seat, decision) =>
        decision.kind === 'pick' ? { ...decision, cards: [SEATS * PACK * 2 + seat] } : decision,
      ),
    });

    expect(saved.DraftLog).toBeUndefined();
    expect(saved.seats[0]!.pickorder).toEqual(legacyBody.state.seats[0]!.picks);
  });

  it('does not accept a pick of more cards than the seat can take', async () => {
    const firstPack = draft.InitialState![0]![0]!.cards;
    const saved = await finish({
      log: tamper((seat, decision) => (seat === 0 ? { kind: 'pick', cards: firstPack.slice() } : decision)),
    });

    expect(saved.DraftLog).toBeUndefined();
    expect(saved.seats[0]!.pickorder).toEqual(legacyBody.state.seats[0]!.picks);
  });

  it('does not accept an Agent of Acquisitions the seat does not have', async () => {
    const saved = await finish({
      log: tamper((seat, decision) =>
        seat === 0 ? { kind: 'takeAll', agent: 0, order: draft.InitialState![0]![0]!.cards.slice() } : decision,
      ),
    });

    expect(saved.DraftLog).toBeUndefined();
  });

  it('rejects a log that is too long', async () => {
    const res = await middleware(validateBody)
      .withBody({ ...legacyBody, log: Array.from({ length: 20001 }, (_, t) => ({ t, d: {} })) })
      .send();
    expect(res.status).toBe(400);
  });

  it('rejects malformed log entries', async () => {
    const res = await middleware(validateBody)
      .withBody({ ...legacyBody, log: [{ t: 'zero', d: 'pick' }] })
      .send();
    expect(res.status).toBe(400);
  });
});
