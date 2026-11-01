import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isVoucher } from '@utils/cardutil';
import Draft from '@utils/datatypes/Draft';
import type { State as LegacyState } from '@utils/datatypes/DraftState';
import {
  actingSeats,
  applyChoice,
  applyTick,
  botArms,
  botChoice,
  botDecision,
  ChoiceEntry,
  createEngineState,
  DraftEvent,
  engineContext,
  engineFromLegacy,
  EngineState,
  frontPack,
  PendingChoice,
  Ratings,
  readyCards,
  SeatDecision,
  SeatTask,
  seatTask,
} from '@utils/drafting/draftEngine';

export const HUMAN = 0;

interface Prediction {
  oracle: string;
  rating: number;
}

const fetchBatchPredict = async (inputs: { pack: string[]; picks: string[] }[]): Promise<Prediction[][]> => {
  const response = await fetch('/api/draftbots/batchpredict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs }),
  });
  if (!response.ok) throw new Error(`Failed to fetch batch predictions: ${response.status}`);
  const json = await response.json();
  return json.prediction ?? [];
};

// The seat that has to answer a pending choice.
export const choiceActor = (choice: PendingChoice): number =>
  choice.kind === 'colors' ? (choice.choosers[choice.colors.length] ?? choice.seat) : choice.seat;

export interface DraftLogLine {
  id: number;
  event: DraftEvent;
  // The event happened during this tick and round (for grouping in the table log).
  round: number;
}

// Abilities armed for the current pick (Librarian, Operative, Grinder/Animus).
export interface PickArming {
  librarians: number[];
  operatives: number[];
  remove: boolean;
}

const NO_ARMING: PickArming = { librarians: [], operatives: [], remove: false };

interface PendingPick {
  tick: number;
  cards: number[];
  removed: number[];
}

interface Options {
  draft: Draft;
  // Cards the player gains other than by picking them from the pack on screen
  // (received last cards, a whole pack, random picks), to place on their board.
  onGain: (cards: number[]) => void;
  // Cards that leave the player's pool (a Cogwork Librarian put back into a pack).
  onLose: (cards: number[]) => void;
  onFinished: (engine: EngineState) => Promise<void>;
}

const initialEngine = (draft: Draft, ctx: ReturnType<typeof engineContext>): EngineState => {
  const read = <T>(key: string): T | null => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  };
  const saved = read<EngineState>(`draftengine-${draft.id}`);
  if (saved && saved.version === 1) return saved;
  // A draft started before this engine: carry on from the old saved state.
  const legacy = read<LegacyState>(`draftstate-${draft.id}`);
  if (legacy && Array.isArray(legacy.seats) && Array.isArray(legacy.stepQueue)) {
    const picks = read<number[]>(`picks-${draft.id}`) ?? legacy.seats[0]?.picks ?? [];
    const trashed = read<number[]>(`trashboard-${draft.id}`) ?? legacy.seats[0]?.trashed ?? [];
    return engineFromLegacy(legacy, picks, trashed, ctx);
  }
  return createEngineState(draft.seats.length, ctx);
};

/**
 * Runs an in-browser draft on the draft engine: the player's decisions come from the
 * table, the bots' from the model's ratings, and every decision is logged so the draft
 * can be replayed exactly. Engine state is kept in localStorage, so a reload carries on.
 */
const useDraftEngine = ({ draft, onGain, onLose, onFinished }: Options) => {
  const ctx = useMemo(() => engineContext(draft), [draft]);
  const [engine, setEngine] = useState<EngineState>(() => initialEngine(draft, ctx));
  const engineRef = useRef(engine);
  useEffect(() => {
    engineRef.current = engine;
    try {
      window.localStorage.setItem(`draftengine-${draft.id}`, JSON.stringify(engine));
    } catch {
      // Storage full or unavailable: the draft still works, it just won't survive a reload.
    }
  }, [engine, draft.id]);

  const [events, setEvents] = useState<DraftLogLine[]>([]);
  const nextEventId = useRef(0);
  const pushEvents = useCallback((list: DraftEvent[], round: number) => {
    if (list.length === 0) return;
    setEvents((previous) => [
      ...previous,
      ...list.map((event) => {
        nextEventId.current += 1;
        return { id: nextEventId.current, event, round };
      }),
    ]);
  }, []);

  const callbacks = useRef({ onGain, onLose, onFinished });
  useEffect(() => {
    callbacks.current = { onGain, onLose, onFinished };
  });

  // ---- Predictions for the current tick ----
  const oracleIds = useCallback(
    (index: number): string[] => {
      const card = draft.cards[index];
      if (!card) return [];
      if (isVoucher(card) && card.voucher_card_indices?.length) {
        return card.voucher_card_indices
          .map((sub) => draft.cards[sub]?.details?.oracle_id)
          .filter((id): id is string => Boolean(id));
      }
      return card.details?.oracle_id ? [card.details.oracle_id] : [];
    },
    [draft.cards],
  );

  const [predictions, setPredictions] = useState<{ key: string; data: Prediction[][] } | null>(null);
  const [predictionsLoading, setPredictionsLoading] = useState(false);
  const [predictError, setPredictError] = useState(false);
  const [retryInProgress, setRetryInProgress] = useState(false);
  const tickKey = `${engine.round}:${engine.tick}`;
  const waitingOnChoice = engine.choices.length > 0;

  const loadPredictions = useCallback(async () => {
    const state = engineRef.current;
    const key = `${state.round}:${state.tick}`;
    setPredictionsLoading(true);
    setPredictError(false);
    try {
      const inputs = state.seats.map((seat, index) => ({
        pack: (frontPack(state, index)?.cards ?? []).flatMap(oracleIds),
        picks: seat.pool.flatMap(oracleIds),
      }));
      const data = await fetchBatchPredict(inputs);
      setPredictions({ key, data });
    } catch (error) {
      console.error('Error fetching predictions:', error);
      setPredictError(true);
    } finally {
      setPredictionsLoading(false);
    }
  }, [oracleIds]);

  useEffect(() => {
    if (engine.done || waitingOnChoice) return;
    if (predictions?.key === tickKey) return;
    if (actingSeats(engine).length === 0) return;
    loadPredictions();
    // Once per tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickKey, waitingOnChoice, engine.done]);

  const retryPredict = useCallback(async () => {
    setRetryInProgress(true);
    try {
      await loadPredictions();
    } finally {
      setRetryInProgress(false);
    }
  }, [loadPredictions]);

  const ratingsFor = useCallback(
    (state: EngineState, seat: number): Ratings => {
      const map: Ratings = new Map();
      const prediction = predictions?.key === `${state.round}:${state.tick}` ? predictions.data[seat] : undefined;
      if (!prediction) return map;
      const byOracle = new Map(prediction.map((entry) => [entry.oracle, entry.rating]));
      for (const card of frontPack(state, seat)?.cards ?? []) {
        const ids = [...new Set(oracleIds(card))];
        map.set(
          card,
          ids.reduce((sum, id) => sum + (byOracle.get(id) ?? 0), 0),
        );
      }
      return map;
    },
    [predictions, oracleIds],
  );

  // ---- The player's decision for this tick ----
  const task: SeatTask = seatTask(engine, HUMAN);
  const [pending, setPending] = useState<PendingPick | null>(null);
  const [arming, setArming] = useState<PickArming>(NO_ARMING);
  const [decision, setDecision] = useState<{ tick: number; decision: SeatDecision } | null>(null);
  const currentPending = pending?.tick === engine.tick ? pending : null;
  const currentDecision = decision?.tick === engine.tick ? decision.decision : null;

  // The draft is paused while a choice is open, and the answer can change what comes next
  // (an added Lore Seeker pack goes first), so the next pack stays hidden until then.
  const front = engine.choices.length > 0 ? null : frontPack(engine, HUMAN);
  const pack = useMemo(
    () => (front ? front.cards.filter((card) => !currentPending?.cards.includes(card)) : []),
    [front, currentPending],
  );
  const extras = arming.librarians.length + arming.operatives.length;
  const needed = task.kind === 'pick' ? Math.min(1 + extras, front?.cards.length ?? 1) : 1;
  // Cards still to pick this turn (more than one with a Librarian or Operative switched on).
  const picked = task.kind === 'pick' ? (currentPending?.cards.length ?? 0) : 0;
  const picksLeft = task.kind === 'pick' ? needed - picked : 0;

  const decide = useCallback(
    (next: SeatDecision) => {
      setDecision({ tick: engineRef.current.tick, decision: next });
    },
    [setDecision],
  );

  const pick = useCallback(
    (card: number, placed = true) => {
      if (task.kind !== 'pick' || currentDecision) return;
      const state = engineRef.current;
      const current = currentPending ?? { tick: state.tick, cards: [], removed: [] };
      if (current.cards.includes(card) || !front?.cards.includes(card)) return;
      // An armed Grinder or Animus removes the first card picked.
      const removing = arming.remove && current.removed.length === 0;
      const updated = {
        ...current,
        cards: [...current.cards, card],
        removed: removing ? [...current.removed, card] : current.removed,
      };
      if (!placed && !removing) callbacks.current.onGain([card]);
      if (updated.cards.length >= needed) {
        decide({
          kind: 'pick',
          cards: updated.cards,
          remove: updated.removed,
          librarians: arming.librarians.slice(0, updated.cards.length - 1),
          operatives: arming.operatives.slice(0, Math.max(0, updated.cards.length - 1 - arming.librarians.length)),
        });
      }
      setPending(updated);
    },
    [task.kind, currentDecision, currentPending, front, arming, needed, decide],
  );

  // Blind (Archdemon) and random picks: any card back gives a random card.
  const pickRandom = useCallback(() => {
    const options = front?.cards.filter((card) => !currentPending?.cards.includes(card)) ?? [];
    if (options.length === 0) return;
    pick(options[Math.floor(Math.random() * options.length)]!, false);
  }, [front, currentPending, pick]);

  const trash = useCallback(
    (card: number) => {
      if (task.kind !== 'trash' || currentDecision) return;
      decide({ kind: 'trash', card });
    },
    [task.kind, currentDecision, decide],
  );

  const pass = useCallback(() => {
    if (task.kind !== 'pass' || currentDecision) return;
    decide({ kind: 'pass' });
  }, [task.kind, currentDecision, decide]);

  const takeAll = useCallback(
    (agent: number) => {
      if (task.kind !== 'pick' || currentDecision || currentPending || !front) return;
      decide({ kind: 'takeAll', agent, order: front.cards.slice() });
    },
    [task.kind, currentDecision, currentPending, front, decide],
  );

  const dredge = useCallback(
    (to: number) => {
      if (task.kind !== 'dredge' || currentDecision) return;
      decide({ kind: 'dredge', to });
    },
    [task.kind, currentDecision, decide],
  );

  // ---- Choices and out-of-turn actions ----
  const runBots = useCallback(
    (input: EngineState): { state: EngineState; events: DraftEvent[] } => {
      let state = input;
      const collected: DraftEvent[] = [];
      for (let guard = 0; guard < 100; guard += 1) {
        for (let seat = 0; seat < state.seats.length; seat += 1) {
          if (seat === HUMAN) continue;
          for (const arm of botArms(state, seat, ctx)) {
            const result = applyChoice(state, arm, ctx);
            state = result.state;
            collected.push(...result.events);
          }
        }
        const choice = state.choices[0];
        if (!choice) break;
        const actor = choiceActor(choice);
        if (actor === HUMAN) break;
        const entry = botChoice(state, actor, ctx, Math.random);
        if (!entry) break;
        const result = applyChoice(state, entry, ctx);
        state = result.state;
        collected.push(...result.events);
      }
      return { state, events: collected };
    },
    [ctx],
  );

  const commit = useCallback(
    (state: EngineState, list: DraftEvent[], round: number) => {
      const bots = runBots(state);
      const all = [...list, ...bots.events];
      // Cards the player gained or lost outside a pick on screen.
      const gained = all
        .filter(
          (event): event is Extract<DraftEvent, { kind: 'received' }> =>
            event.kind === 'received' && event.seat === HUMAN,
        )
        .map((event) => event.card);
      const lost = all
        .filter(
          (event): event is Extract<DraftEvent, { kind: 'returned' }> =>
            event.kind === 'returned' && event.seat === HUMAN,
        )
        .map((event) => event.card);
      if (gained.length > 0) callbacks.current.onGain(gained);
      if (lost.length > 0) callbacks.current.onLose(lost);
      engineRef.current = bots.state;
      setEngine(bots.state);
      pushEvents(all, round);
    },
    [runBots, pushEvents],
  );

  const answer = useCallback(
    (entry: ChoiceEntry) => {
      const state = engineRef.current;
      const result = applyChoice(state, entry, ctx);
      commit(result.state, result.events, state.round);
    },
    [ctx, commit],
  );

  // Arming: Librarian and Operative add a card to this pick, Grinder and Animus remove
  // the next card picked, and the note cards (Banneret, Vanguard, Smuggler) wait for the
  // next card that fits.
  const toggleArm = useCallback(
    (card: number) => {
      const effect = ctx.effectOf(card)?.id;
      if (effect === 'banneret' || effect === 'vanguard' || effect === 'smuggler') {
        const armed = engineRef.current.seats[HUMAN]?.armed.includes(card) ?? false;
        answer({ kind: 'arm', seat: HUMAN, card, on: !armed });
        return;
      }
      setArming((current) => {
        const toggle = (list: number[]) => (list.includes(card) ? list.filter((c) => c !== card) : [...list, card]);
        if (effect === 'librarian') return { ...current, librarians: toggle(current.librarians) };
        if (effect === 'operative') return { ...current, operatives: toggle(current.operatives) };
        if (effect === 'grinder' || effect === 'animus') return { ...current, remove: !current.remove };
        return current;
      });
    },
    [ctx, answer],
  );

  const watchWithInformant = useCallback(
    (card: number, target: number) => answer({ kind: 'informant', seat: HUMAN, card, target }),
    [answer],
  );
  const peekWithWhispergear = useCallback(
    (card: number) => answer({ kind: 'whispergear', seat: HUMAN, card }),
    [answer],
  );

  // ---- Resolving a tick ----
  const humanDecision = currentDecision;
  const humanActs = task.kind !== 'idle';
  const predictionsReady = predictions?.key === tickKey;

  useEffect(() => {
    if (engine.done || waitingOnChoice || !predictionsReady) return undefined;
    if (actingSeats(engine).length === 0) return undefined;
    if (humanActs && !humanDecision) return undefined;
    // A short beat when only the bots are acting, so passes don't blur together.
    const timer = setTimeout(
      () => {
        const state = engineRef.current;
        if (state.tick !== engine.tick) return;
        const decisions: Record<number, SeatDecision> = {};
        for (const seat of actingSeats(state)) {
          if (seat === HUMAN) {
            if (humanDecision) decisions[seat] = humanDecision;
          } else {
            const botPick = botDecision(state, seat, ctx, ratingsFor(state, seat), Math.random);
            if (botPick) decisions[seat] = botPick;
          }
        }
        const result = applyTick(state, decisions, ctx);
        // Cards the player took all at once go on their board.
        if (humanDecision?.kind === 'takeAll') callbacks.current.onGain(humanDecision.order);
        setPending(null);
        setArming(NO_ARMING);
        setDecision(null);
        commit(result.state, result.events, state.round);
      },
      humanActs ? 0 : 450,
    );
    return () => clearTimeout(timer);
  }, [engine, waitingOnChoice, predictionsReady, humanActs, humanDecision, ctx, ratingsFor, commit]);

  // Random steps (pickrandom/trashrandom) pick themselves after a moment; a single
  // Canal Dredger holder gets the last card without asking.
  useEffect(() => {
    if (currentDecision || engine.done) return undefined;
    if (task.kind === 'dredge' && task.holders.length === 1) {
      decide({ kind: 'dredge', to: task.holders[0]! });
      return undefined;
    }
    if ((task.kind === 'pick' && task.random && !task.blind) || (task.kind === 'trash' && task.random)) {
      const timer = setTimeout(() => {
        if (task.kind === 'trash') {
          const options = front?.cards ?? [];
          if (options.length) trash(options[Math.floor(Math.random() * options.length)]!);
        } else {
          pickRandom();
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [task, currentDecision, engine.done, decide, front, trash, pickRandom]);

  // ---- Finishing ----
  const finishing = useRef(false);
  useEffect(() => {
    if (!engine.done || finishing.current) return;
    finishing.current = true;
    callbacks.current.onFinished(engine).catch(() => {
      finishing.current = false;
    });
  }, [engine]);

  // Ratings for the cards on screen, normalized to add up to 1.
  const ratings = useMemo(() => {
    const map = ratingsFor(engine, HUMAN);
    const raw = pack.map((card) => map.get(card) ?? 0);
    const total = raw.reduce((sum, value) => sum + value, 0);
    return total > 0 ? raw.map((value) => value / total) : raw;
  }, [ratingsFor, engine, pack]);

  const humanChoice = engine.choices[0] && choiceActor(engine.choices[0]) === HUMAN ? engine.choices[0] : null;

  return {
    engine,
    ctx,
    task,
    pack,
    front,
    ratings,
    predictionsLoading,
    predictError,
    retryPredict,
    retryInProgress,
    // The player has decided and is waiting on the bots.
    waiting: !!currentDecision,
    picked,
    picksLeft,
    ready: readyCards(engine, HUMAN, ctx),
    arming,
    humanChoice,
    events,
    done: engine.done,
    pick,
    pickRandom,
    trash,
    pass,
    takeAll,
    dredge,
    toggleArm,
    answer,
    watchWithInformant,
    peekWithWhispergear,
  };
};

export default useDraftEngine;
