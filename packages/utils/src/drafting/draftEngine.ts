import { cardColors, cardName, cardType } from '../cardutil';
import Card from '../datatypes/Card';
import Draft, { DraftStep, LoreSeekerPack } from '../datatypes/Draft';
import type { State as LegacyState } from '../datatypes/DraftState';
import { ANIMUS_KEYWORDS, DraftEffect, DraftEffectId, draftEffectOf } from './draftEffects';

/**
 * The in-browser draft, as a deterministic state machine shared by the live draft
 * (decisions from the player and the bots) and every replay of it (the pick-by-pick
 * breakdown, analytics jobs), which re-apply the recorded decisions.
 *
 * Each seat has a queue of packs. On every tick, each seat with a pack acts on the
 * front one, then passes it to the back of the next seat's queue. A plain draft runs
 * exactly as before (every seat always holds one pack), and the draft-matters cards
 * (extra picks, skipped packs, whole-pack takes, last cards going elsewhere, added
 * packs) fall out of the same rules. A pack's steps (pick, pass, trash, ...) travel
 * with it: whoever holds it does its next step.
 *
 * Everything here is plain data, so a state can be stored (the live draft keeps it in
 * localStorage) and cloned freely.
 */

export type UnitAction = 'pick' | 'pass' | 'trash' | 'pickrandom' | 'trashrandom';

export interface EnginePack {
  id: number;
  cards: number[];
  // Remaining steps, one per card action (a step of amount 2 is two entries).
  steps: UnitAction[];
  round: number;
  opener: number;
  // The Lore Seeker (draft card index) that added this pack, if one did.
  loreSource: number | null;
  // Cards when it was opened, for labels.
  size: number;
  // The seat that last held it, i.e. who passed it on (Cogwork Tracker).
  lastHolder: number | null;
  // Cogwork Spy and Spire Phantasm watch the next card drafted from a pack.
  watchers: PackWatcher[];
}

export type PackWatcher =
  { kind: 'spy'; seat: number; card: number } | { kind: 'guess'; seat: number; card: number; guess: number };

// Information noted for a card as it was drafted, rendered by noteText.
export type DraftNote =
  | { kind: 'pick'; n: number }
  | { kind: 'seat'; seat: number }
  | { kind: 'name'; card: number }
  | { kind: 'types'; types: string[] }
  | { kind: 'colors'; colors: string[] }
  | { kind: 'keywords'; keywords: string[] }
  | { kind: 'guess'; right: boolean };

export interface EngineSeat {
  queue: number[];
  // Cards in the seat's pool, oldest first. Removed cards and Librarians put back
  // into a pack aren't in it.
  pool: number[];
  trashed: number[];
  // Removed from the draft (Cogwork Grinder, Animus of Predation): drafted, never in a pool.
  removed: number[];
  // Face-up cards with abilities: ready (or passive) until turned face down.
  faceUp: number[];
  // Turned face down after use.
  used: number[];
  notes: Record<number, DraftNote[]>;
  draftedThisRound: number;
  // Packs still to pass without drafting (Leovold's Operative).
  skipsOwed: number;
  // No more drafting this round (Agent of Acquisitions).
  passOnly: boolean;
  agentUsedRound: boolean;
  // Blind random picks left (Archdemon of Paliano).
  randomLeft: number;
  // Noble Banneret, Paliano Vanguard and Smuggler Captain waiting for a card to note.
  armed: number[];
  // Aether Searchers waiting for the next card's name.
  searchers: number[];
}

export type PendingChoice =
  | { kind: 'lore'; seat: number; card: number }
  | { kind: 'colors'; seat: number; card: number; choosers: number[]; colors: string[] }
  | { kind: 'guess'; seat: number; card: number; pack: number };

export interface EngineState {
  version: 1;
  round: number;
  rounds: number;
  tick: number;
  seats: EngineSeat[];
  packs: Record<number, EnginePack>;
  nextPackId: number;
  // Seats that drafted a Canal Dredger, in the order they did.
  dredgers: number[];
  // Choices to resolve before the next tick.
  choices: PendingChoice[];
  // Illusionary Informant: see the next card `target` drafts.
  watches: { seat: number; card: number; target: number }[];
  // Lore Seekers whose pack was added.
  loreUsed: number[];
  // Packs added this round, for the "+1 pack this round" label.
  addedThisRound: number;
  log: DraftLogEntry[];
  // True when started from a draft in progress under the old engine: the log
  // doesn't cover the whole draft, so it isn't saved.
  partialLog: boolean;
  done: boolean;
}

// What a seat does on a tick.
export type SeatDecision =
  | {
      kind: 'pick';
      // In draft order; more than one with Cogwork Librarian or Leovold's Operative.
      cards: number[];
      // Of those, the ones removed from the draft.
      remove?: number[];
      librarians?: number[];
      operatives?: number[];
    }
  | { kind: 'trash'; card: number }
  | { kind: 'takeAll'; agent: number; order: number[] }
  | { kind: 'pass' }
  | { kind: 'dredge'; to: number };

// Answers and actions outside a tick.
export type ChoiceEntry =
  | { kind: 'lore'; seat: number; card: number; add: boolean }
  | { kind: 'color'; seat: number; card: number; color: string }
  | { kind: 'guess'; seat: number; card: number; guess: number }
  | { kind: 'arm'; seat: number; card: number; on: boolean }
  | { kind: 'informant'; seat: number; card: number; target: number }
  | { kind: 'whispergear'; seat: number; card: number };

export type DraftLogEntry = { t: number; d: Record<number, SeatDecision> } | { t: number; c: ChoiceEntry };

export type SeatTask =
  | { kind: 'idle' }
  | { kind: 'pick'; pack: number; random: boolean; blind: boolean }
  | { kind: 'trash'; pack: number; random: boolean }
  // Look at the pack, then pass it on.
  | { kind: 'pass'; pack: number }
  // The pack's last card goes to a Canal Dredger holder.
  | { kind: 'dredge'; pack: number; holders: number[] };

// What happened, for toasts, the table log and animations.
export type DraftEvent =
  | { kind: 'drafted'; seat: number; card: number }
  | { kind: 'revealed'; seat: number; card: number }
  | { kind: 'used'; seat: number; card: number }
  | { kind: 'removed'; seat: number; card: number }
  | { kind: 'note'; seat: number; card: number; note: DraftNote }
  | { kind: 'received'; seat: number; card: number; from: number }
  | { kind: 'returned'; seat: number; card: number; pack: number }
  | { kind: 'lore'; seat: number; card: number; pack: number; size: number }
  | { kind: 'skipped'; seat: number; pack: number }
  | { kind: 'spy'; seat: number; card: number; by: number }
  | { kind: 'guess'; seat: number; card: number; drafted: number; right: boolean }
  | { kind: 'informant'; seat: number; target: number; card: number }
  | { kind: 'color'; seat: number; owner: number; card: number; color: string }
  | { kind: 'round'; round: number };

export interface EngineContext {
  cards: Card[];
  effectOf: (card: number) => DraftEffect | null;
  initialState: { cards: number[]; steps: DraftStep[] }[][];
  lorePacks: Map<number, LoreSeekerPack>;
}

export const COLORS = ['W', 'U', 'B', 'R', 'G'];

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export const engineContext = (draft: Draft): EngineContext => {
  const effects = draft.cards.map((card) => draftEffectOf(card));
  return {
    cards: draft.cards,
    effectOf: (card) => effects[card] ?? null,
    initialState: draft.InitialState ?? [],
    lorePacks: new Map((draft.LoreSeekerPacks ?? []).map((pack) => [pack.source, pack])),
  };
};

/** One entry per card action; a step of amount N is N entries. End-of-pack markers are dropped. */
export const unitSteps = (steps: DraftStep[] | null | undefined, cards: number): UnitAction[] => {
  const units: UnitAction[] = [];
  if (!steps || steps.length === 0) {
    for (let i = 0; i < cards; i += 1) {
      if (i > 0) units.push('pass');
      units.push('pick');
    }
    return units;
  }
  for (const step of steps) {
    if (step.action === 'endpack') continue;
    const amount = step.amount ?? 1;
    for (let i = 0; i < amount; i += 1) units.push(step.action as UnitAction);
  }
  return units;
};

const isCardAction = (action: UnitAction | undefined) => action !== undefined && action !== 'pass';
const hasCardAction = (pack: EnginePack) => pack.steps.some(isCardAction);
const nextCardAction = (pack: EnginePack) => pack.steps.find(isCardAction);

// Uses up the pack's next card action (and any passes in front of it).
const consumeCardAction = (pack: EnginePack) => {
  while (pack.steps.length && !isCardAction(pack.steps[0])) pack.steps.shift();
  pack.steps.shift();
};

const createPack = (
  state: EngineState,
  cards: number[],
  steps: DraftStep[] | null | undefined,
  round: number,
  opener: number,
  loreSource: number | null,
): EnginePack => {
  const pack: EnginePack = {
    id: state.nextPackId,
    cards: cards.slice(),
    steps: unitSteps(steps, cards.length),
    round,
    opener,
    loreSource,
    size: cards.length,
    lastHolder: null,
    watchers: [],
  };
  state.nextPackId += 1;
  state.packs[pack.id] = pack;
  return pack;
};

const emptySeat = (): EngineSeat => ({
  queue: [],
  pool: [],
  trashed: [],
  removed: [],
  faceUp: [],
  used: [],
  notes: {},
  draftedThisRound: 0,
  skipsOwed: 0,
  passOnly: false,
  agentUsedRound: false,
  randomLeft: 0,
  armed: [],
  searchers: [],
});

const openRound = (state: EngineState, ctx: EngineContext, round: number, events: DraftEvent[]) => {
  state.round = round;
  state.addedThisRound = 0;
  state.seats.forEach((seat, index) => {
    seat.queue = [];
    seat.draftedThisRound = 0;
    seat.passOnly = false;
    seat.agentUsedRound = false;
    const initial = ctx.initialState[index]?.[round];
    if (initial && initial.cards.length > 0) {
      seat.queue.push(createPack(state, initial.cards, initial.steps, round, index, null).id);
    }
  });
  events.push({ kind: 'round', round });
};

export const createEngineState = (seatCount: number, ctx: EngineContext): EngineState => {
  const state: EngineState = {
    version: 1,
    round: 0,
    rounds: Math.max(0, ...ctx.initialState.map((seat) => seat?.length ?? 0)),
    tick: 0,
    seats: Array.from({ length: seatCount }, emptySeat),
    packs: {},
    nextPackId: 0,
    dredgers: [],
    choices: [],
    watches: [],
    loreUsed: [],
    addedThisRound: 0,
    log: [],
    partialLog: false,
    done: false,
  };
  if (state.rounds === 0) {
    state.done = true;
    return state;
  }
  openRound(state, ctx, 0, []);
  return state;
};

/**
 * Picks up a draft that was in progress under the old lock-step engine, so a page
 * reload after a deploy carries on where it was. The log only covers what happens
 * from here, so it isn't saved (the breakdown replays the old way).
 */
export const engineFromLegacy = (
  legacy: LegacyState,
  humanPicks: number[],
  humanTrashed: number[],
  ctx: EngineContext,
): EngineState => {
  const seatCount = legacy.seats.length;
  const state = createEngineState(seatCount, ctx);
  state.round = Math.max(0, legacy.pack - 1);
  state.packs = {};
  state.nextPackId = 0;
  state.partialLog = true;

  // The rest of this round's steps, shared by every pack in the old engine.
  const remaining: DraftStep[] = [];
  for (const step of legacy.stepQueue) {
    if (step.action === 'endpack') break;
    remaining.push(step);
  }

  legacy.seats.forEach((legacySeat, index) => {
    const seat = state.seats[index]!;
    const picks = index === 0 ? humanPicks : legacySeat.picks;
    const trashed = index === 0 ? humanTrashed : legacySeat.trashed;
    seat.pool = picks.filter((card) => card !== undefined && card !== null).reverse();
    seat.trashed = trashed.filter((card) => card !== undefined && card !== null).reverse();
    seat.queue = [];
    if (legacySeat.pack.length > 0 && remaining.length > 0) {
      seat.queue.push(createPack(state, legacySeat.pack, remaining, state.round, index, null).id);
    }
  });
  // Between rounds, the next one opens now.
  settle(state, ctx, []);
  return state;
};

// ---- Reading the state ----

export const seatTask = (state: EngineState, seatIndex: number): SeatTask => {
  if (state.done || state.choices.length > 0) return { kind: 'idle' };
  const seat = state.seats[seatIndex];
  const packId = seat?.queue[0];
  if (seat === undefined || packId === undefined) return { kind: 'idle' };
  const pack = state.packs[packId];
  if (!pack || pack.cards.length === 0 || !hasCardAction(pack)) return { kind: 'idle' };

  if (seat.passOnly || seat.skipsOwed > 0) return { kind: 'pass', pack: packId };
  if (pack.cards.length === 1 && state.dredgers.length > 0) {
    return { kind: 'dredge', pack: packId, holders: state.dredgers.slice() };
  }
  const action = nextCardAction(pack);
  if (action === 'trash' || action === 'trashrandom') {
    return { kind: 'trash', pack: packId, random: action === 'trashrandom' };
  }
  const blind = seat.randomLeft > 0;
  return { kind: 'pick', pack: packId, random: action === 'pickrandom' || blind, blind };
};

export const actingSeats = (state: EngineState): number[] =>
  state.seats.map((_, index) => index).filter((index) => seatTask(state, index).kind !== 'idle');

export const frontPack = (state: EngineState, seat: number): EnginePack | null => {
  const id = state.seats[seat]?.queue[0];
  return id === undefined ? null : (state.packs[id] ?? null);
};

const effectIs = (ctx: EngineContext, card: number, ids: DraftEffectId[]) => {
  const effect = ctx.effectOf(card);
  return effect !== null && ids.includes(effect.id);
};

const faceUpWith = (seat: EngineSeat, ctx: EngineContext, ids: DraftEffectId[]) =>
  seat.faceUp.filter((card) => effectIs(ctx, card, ids));

export const canRemove = (seat: EngineSeat, ctx: EngineContext) =>
  faceUpWith(seat, ctx, ['grinder', 'animus']).length > 0;

/**
 * Face-up cards whose ability the seat can use right now (what rocks on the table).
 * Passive and forced effects (Canal Dredger, Archdemon) never count.
 */
export const readyCards = (state: EngineState, seatIndex: number, ctx: EngineContext): number[] => {
  const seat = state.seats[seatIndex];
  if (!seat || state.done) return [];
  const task = seatTask(state, seatIndex);
  const pack = task.kind === 'pick' ? state.packs[task.pack] : undefined;
  const picking = task.kind === 'pick' && !task.blind && !task.random && pack !== undefined;
  return seat.faceUp.filter((card) => {
    const effect = ctx.effectOf(card);
    if (!effect) return false;
    switch (effect.id) {
      case 'librarian':
      case 'operative':
        return picking && pack!.cards.length >= 2;
      case 'agent':
        return picking && !seat.agentUsedRound;
      case 'grinder':
      case 'animus':
        return task.kind === 'pick';
      case 'banneret':
      case 'vanguard':
      case 'smuggler':
        return !seat.armed.includes(card);
      case 'informant':
      case 'whispergear':
        return true;
      default:
        return false;
    }
  });
};

// ---- Applying decisions ----

const removeFrom = (list: number[], card: number) => {
  const index = list.indexOf(card);
  if (index >= 0) list.splice(index, 1);
  return index >= 0;
};

const isCreature = (card: Card | undefined) => !!card && cardType(card).includes('Creature');

const creatureTypes = (card: Card | undefined): string[] => {
  if (!card) return [];
  const type = cardType(card);
  const split = type.split(/\s+[—-]\s+/);
  return split.length > 1 ? split[1]!.split(/\s+/).filter(Boolean) : [];
};

const addNote = (state: EngineState, seat: number, card: number, note: DraftNote, events: DraftEvent[]) => {
  const notes = state.seats[seat]!.notes;
  notes[card] = [...(notes[card] ?? []), note];
  events.push({ kind: 'note', seat, card, note });
};

const turnFaceDown = (seat: EngineSeat, card: number) => {
  if (removeFrom(seat.faceUp, card)) seat.used.push(card);
};

interface DraftOptions {
  pack: EnginePack | null;
  // Who passed this card on (Cogwork Tracker).
  passer: number | null;
  remove?: boolean;
}

// A card enters a seat's draft: into the pool, or removed. Applies every
// as-you-draft-it effect (reveals, notes, watchers, armed cards).
const draftCard = (
  state: EngineState,
  seatIndex: number,
  card: number,
  options: DraftOptions,
  ctx: EngineContext,
  events: DraftEvent[],
) => {
  const seat = state.seats[seatIndex]!;
  const seatCount = state.seats.length;
  seat.draftedThisRound += 1;
  const nth = seat.draftedThisRound;
  const effect = ctx.effectOf(card);
  const details = ctx.cards[card];

  // Aether Searchers note the next card drafted after them.
  for (const searcher of seat.searchers) addNote(state, seatIndex, searcher, { kind: 'name', card }, events);
  seat.searchers = [];

  // Cogwork Spy and Spire Phantasm watch the next card drafted from their pack.
  if (options.pack && options.pack.watchers.length > 0) {
    for (const watcher of options.pack.watchers) {
      if (watcher.kind === 'spy') {
        events.push({ kind: 'spy', seat: watcher.seat, card, by: seatIndex });
      } else {
        // Guessing names a card, so another copy of it counts.
        const nameOf = (index: number) => (ctx.cards[index] ? cardName(ctx.cards[index]!) : null);
        const right = watcher.guess === card || (nameOf(card) !== null && nameOf(watcher.guess) === nameOf(card));
        addNote(state, watcher.seat, watcher.card, { kind: 'guess', right }, events);
        events.push({ kind: 'guess', seat: watcher.seat, card: watcher.card, drafted: card, right });
      }
    }
    options.pack.watchers = [];
  }

  // Illusionary Informant sees the next card its target drafts.
  state.watches = state.watches.filter((watch) => {
    if (watch.target !== seatIndex) return true;
    events.push({ kind: 'informant', seat: watch.seat, target: seatIndex, card });
    return false;
  });

  const removing = !!options.remove && canRemove(seat, ctx);
  if (removing) {
    seat.removed.push(card);
    events.push({ kind: 'removed', seat: seatIndex, card });
    // Animus of Predation keeps the listed keywords of creatures removed with it.
    const keywords = isCreature(details)
      ? (details?.details?.keywords ?? []).filter((keyword) => ANIMUS_KEYWORDS.includes(keyword))
      : [];
    if (keywords.length > 0) {
      for (const animus of faceUpWith(seat, ctx, ['animus'])) {
        const known = (seat.notes[animus] ?? []).flatMap((note) => (note.kind === 'keywords' ? note.keywords : []));
        const added = keywords.filter((keyword) => !known.includes(keyword));
        if (added.length > 0) addNote(state, seatIndex, animus, { kind: 'keywords', keywords: added }, events);
      }
    }
  } else {
    seat.pool.push(card);
  }

  if (effect) {
    if (effect.faceUp) {
      // A removed face-up card has no effect.
      if (!removing) {
        if (!seat.faceUp.includes(card)) seat.faceUp.push(card);
        events.push({ kind: 'drafted', seat: seatIndex, card });
        if (effect.id === 'archdemon') seat.randomLeft = Math.max(seat.randomLeft, 3);
        if (effect.id === 'dredger' && !state.dredgers.includes(seatIndex)) state.dredgers.push(seatIndex);
      }
    } else {
      // Revealed as it's drafted, removed or not.
      events.push({ kind: 'revealed', seat: seatIndex, card });
    }

    switch (effect.id) {
      case 'pickNote':
        if (!removing) addNote(state, seatIndex, card, { kind: 'pick', n: nth }, events);
        break;
      case 'tracker':
        if (!removing && options.passer !== null && options.passer !== seatIndex) {
          addNote(state, seatIndex, card, { kind: 'seat', seat: options.passer }, events);
        }
        break;
      case 'aetherSearcher':
        if (!removing) seat.searchers.push(card);
        break;
      case 'spy':
        if (options.pack && options.pack.cards.length > 0) {
          options.pack.watchers.push({ kind: 'spy', seat: seatIndex, card });
        }
        break;
      case 'spire':
        // No guessing game if it was the pack's last card.
        if (options.pack && options.pack.cards.length > 0) {
          state.choices.push({ kind: 'guess', seat: seatIndex, card, pack: options.pack.id });
        }
        break;
      case 'palianoCity':
      case 'regicide': {
        // The player to the right chooses, then the drafter, then the player to the left.
        const right = (seatIndex + 1) % seatCount;
        const left = (seatIndex - 1 + seatCount) % seatCount;
        state.choices.push({ kind: 'colors', seat: seatIndex, card, choosers: [right, seatIndex, left], colors: [] });
        break;
      }
      case 'loreSeeker':
        if (ctx.lorePacks.has(card) && !state.loreUsed.includes(card)) {
          state.choices.push({ kind: 'lore', seat: seatIndex, card });
        }
        break;
      default:
        break;
    }
  }

  // Noble Banneret, Paliano Vanguard and Smuggler Captain note the next card that fits.
  seat.armed = seat.armed.filter((armed) => {
    if (armed === card) return true;
    const armedEffect = ctx.effectOf(armed)?.id;
    if (armedEffect !== 'smuggler' && !isCreature(details)) return true;
    const note: DraftNote =
      armedEffect === 'vanguard' ? { kind: 'types', types: creatureTypes(details) } : { kind: 'name', card };
    addNote(state, seatIndex, armed, note, events);
    turnFaceDown(seat, armed);
    events.push({ kind: 'used', seat: seatIndex, card: armed });
    return false;
  });
};

// Every seat with nothing to draft holds a pack it can only pass (Agent of
// Acquisitions all round): those packs would go round forever, so the round ends.
const onlyPassOnlyLeft = (state: EngineState) =>
  state.seats.every((seat) => seat.queue.length === 0 || seat.passOnly) &&
  state.seats.some((seat) => seat.queue.length > 0);

// After a tick or a choice: when every pack is done and nothing is waiting on a
// choice, open the next round or finish the draft.
const settle = (state: EngineState, ctx: EngineContext, events: DraftEvent[]) => {
  if (state.choices.length > 0) return;
  if (onlyPassOnlyLeft(state)) {
    for (const seat of state.seats) {
      for (const id of seat.queue) delete state.packs[id];
      seat.queue = [];
    }
  }
  if (state.seats.some((seat) => seat.queue.length > 0)) return;
  if (state.round + 1 >= state.rounds) {
    state.done = true;
    return;
  }
  openRound(state, ctx, state.round + 1, events);
};

export const passDirection = (round: number) => (round % 2 === 0 ? -1 : 1);

// Whether a decision is one the seat could have made: the right kind for its task, and
// only abilities it has (one card per pick plus one per Librarian or Operative used).
const fitsTask = (
  state: EngineState,
  seatIndex: number,
  task: SeatTask,
  decision: SeatDecision,
  ctx: EngineContext,
): boolean => {
  const seat = state.seats[seatIndex]!;
  const usable = (card: number, effect: DraftEffectId) => seat.faceUp.includes(card) && effectIs(ctx, card, [effect]);
  switch (decision.kind) {
    case 'pick': {
      if (task.kind !== 'pick') return false;
      const librarians = decision.librarians ?? [];
      const operatives = decision.operatives ?? [];
      return (
        new Set(decision.cards).size === decision.cards.length &&
        librarians.every((card) => usable(card, 'librarian')) &&
        operatives.every((card) => usable(card, 'operative')) &&
        decision.cards.length <= 1 + librarians.length + operatives.length
      );
    }
    case 'trash':
      return task.kind === 'trash';
    case 'takeAll':
      return task.kind === 'pick' && !task.blind && !seat.agentUsedRound && usable(decision.agent, 'agent');
    case 'pass':
      return task.kind === 'pass';
    case 'dredge':
      return task.kind === 'dredge' && task.holders.includes(decision.to);
    default:
      return false;
  }
};

/**
 * Applies one tick: every seat with something to do acts on its front pack, then
 * packs move on. `decisions` must have an entry for every acting seat.
 */
export const applyTick = (
  input: EngineState,
  decisions: Record<number, SeatDecision>,
  ctx: EngineContext,
): { state: EngineState; events: DraftEvent[] } => {
  const state = clone(input);
  const events: DraftEvent[] = [];
  const seatCount = state.seats.length;
  const tasks = state.seats.map((_, index) => seatTask(state, index));
  const passOn: number[] = [];

  tasks.forEach((task, seatIndex) => {
    if (task.kind === 'idle') return;
    const seat = state.seats[seatIndex]!;
    const pack = state.packs[task.pack]!;
    const decision = decisions[seatIndex];
    // A decision that doesn't fit what the seat can do (only possible in a tampered log)
    // is ignored, which leaves the seat holding its pack.
    if (!decision || !fitsTask(state, seatIndex, task, decision, ctx)) return;

    switch (decision.kind) {
      case 'pick': {
        const removing = new Set(decision.remove ?? []);
        for (const card of decision.cards) {
          if (!removeFrom(pack.cards, card)) continue;
          draftCard(state, seatIndex, card, { pack, passer: pack.lastHolder, remove: removing.has(card) }, ctx, events);
        }
        for (const librarian of decision.librarians ?? []) {
          if (!removeFrom(seat.pool, librarian)) continue;
          removeFrom(seat.faceUp, librarian);
          pack.cards.push(librarian);
          events.push({ kind: 'used', seat: seatIndex, card: librarian });
          events.push({ kind: 'returned', seat: seatIndex, card: librarian, pack: pack.id });
        }
        for (const operative of decision.operatives ?? []) {
          if (!seat.faceUp.includes(operative)) continue;
          turnFaceDown(seat, operative);
          seat.skipsOwed += 1;
          events.push({ kind: 'used', seat: seatIndex, card: operative });
        }
        if (task.kind === 'pick' && task.blind && seat.randomLeft > 0) {
          seat.randomLeft -= 1;
          if (seat.randomLeft === 0) {
            for (const archdemon of faceUpWith(seat, ctx, ['archdemon'])) turnFaceDown(seat, archdemon);
          }
        }
        consumeCardAction(pack);
        break;
      }
      case 'trash': {
        if (removeFrom(pack.cards, decision.card)) seat.trashed.push(decision.card);
        consumeCardAction(pack);
        break;
      }
      case 'takeAll': {
        for (const card of decision.order) {
          if (!removeFrom(pack.cards, card)) continue;
          draftCard(state, seatIndex, card, { pack, passer: pack.lastHolder }, ctx, events);
        }
        turnFaceDown(seat, decision.agent);
        seat.passOnly = true;
        seat.agentUsedRound = true;
        events.push({ kind: 'used', seat: seatIndex, card: decision.agent });
        consumeCardAction(pack);
        break;
      }
      case 'pass': {
        if (!seat.passOnly && seat.skipsOwed > 0) seat.skipsOwed -= 1;
        events.push({ kind: 'skipped', seat: seatIndex, pack: pack.id });
        passOn.push(seatIndex);
        return;
      }
      case 'dredge': {
        const card = pack.cards[0];
        if (card !== undefined) {
          pack.cards.splice(0, 1);
          draftCard(state, decision.to, card, { pack, passer: seatIndex }, ctx, events);
          events.push({ kind: 'received', seat: decision.to, card, from: seatIndex });
        }
        consumeCardAction(pack);
        break;
      }
      default:
        break;
    }
    passOn.push(seatIndex);
  });

  // Move each acted-on pack along: on to the next seat, kept for another action, or done.
  const direction = passDirection(state.round);
  const arrivals: { seat: number; pack: number }[] = [];
  for (const seatIndex of passOn) {
    const seat = state.seats[seatIndex]!;
    const packId = seat.queue[0];
    if (packId === undefined) continue;
    const pack = state.packs[packId]!;
    const lookedOnly = decisions[seatIndex]?.kind === 'pass';
    if (!lookedOnly && (pack.cards.length === 0 || !hasCardAction(pack))) {
      seat.queue.shift();
      delete state.packs[packId];
      continue;
    }
    if (!lookedOnly && isCardAction(pack.steps[0])) continue; // e.g. pick 2: the seat keeps it
    if (!lookedOnly) {
      while (pack.steps.length && !isCardAction(pack.steps[0])) pack.steps.shift();
    }
    seat.queue.shift();
    pack.lastHolder = seatIndex;
    arrivals.push({ seat: (seatIndex + direction + seatCount) % seatCount, pack: packId });
  }
  for (const arrival of arrivals) state.seats[arrival.seat]!.queue.push(arrival.pack);

  state.log.push({ t: state.tick, d: decisions });
  state.tick += 1;
  settle(state, ctx, events);
  return { state, events };
};

/** Applies a choice answer or an out-of-turn action (arming a card, Informant, Whispergear). */
export const applyChoice = (
  input: EngineState,
  entry: ChoiceEntry,
  ctx: EngineContext,
): { state: EngineState; events: DraftEvent[] } => {
  const state = clone(input);
  const events: DraftEvent[] = [];
  const seat = state.seats[entry.seat];
  if (!seat) return { state, events };

  switch (entry.kind) {
    case 'lore': {
      state.choices = state.choices.filter((choice) => !(choice.kind === 'lore' && choice.card === entry.card));
      const lorePack = ctx.lorePacks.get(entry.card);
      if (entry.add && lorePack && !state.loreUsed.includes(entry.card)) {
        state.loreUsed.push(entry.card);
        const pack = createPack(state, lorePack.cards, lorePack.steps, state.round, entry.seat, entry.card);
        // Your next pick is from the added pack.
        seat.queue.unshift(pack.id);
        state.addedThisRound += 1;
        events.push({ kind: 'used', seat: entry.seat, card: entry.card });
        events.push({ kind: 'lore', seat: entry.seat, card: entry.card, pack: pack.id, size: pack.size });
      }
      break;
    }
    case 'color': {
      const choice = state.choices.find(
        (candidate): candidate is Extract<PendingChoice, { kind: 'colors' }> =>
          candidate.kind === 'colors' && candidate.card === entry.card,
      );
      if (choice && !choice.colors.includes(entry.color) && COLORS.includes(entry.color)) {
        choice.colors.push(entry.color);
        events.push({ kind: 'color', seat: entry.seat, owner: choice.seat, card: entry.card, color: entry.color });
        if (choice.colors.length >= 3) {
          state.choices = state.choices.filter((candidate) => candidate !== choice);
          addNote(state, choice.seat, choice.card, { kind: 'colors', colors: choice.colors }, events);
        }
      }
      break;
    }
    case 'guess': {
      const packId = findGuessPack(state, entry.card);
      state.choices = state.choices.filter((choice) => !(choice.kind === 'guess' && choice.card === entry.card));
      const pack = packId === undefined ? undefined : state.packs[packId];
      if (pack && entry.guess >= 0) {
        pack.watchers.push({ kind: 'guess', seat: entry.seat, card: entry.card, guess: entry.guess });
      }
      break;
    }
    case 'arm': {
      if (entry.on) {
        if (seat.faceUp.includes(entry.card) && !seat.armed.includes(entry.card)) seat.armed.push(entry.card);
      } else {
        removeFrom(seat.armed, entry.card);
      }
      break;
    }
    case 'informant': {
      if (seat.faceUp.includes(entry.card)) {
        turnFaceDown(seat, entry.card);
        state.watches.push({ seat: entry.seat, card: entry.card, target: entry.target });
        events.push({ kind: 'used', seat: entry.seat, card: entry.card });
      }
      break;
    }
    case 'whispergear': {
      if (seat.faceUp.includes(entry.card)) {
        turnFaceDown(seat, entry.card);
        events.push({ kind: 'used', seat: entry.seat, card: entry.card });
      }
      break;
    }
    default:
      break;
  }

  state.log.push({ t: state.tick, c: entry });
  settle(state, ctx, events);
  return { state, events };
};

const findGuessPack = (state: EngineState, card: number): number | undefined => {
  const choice = state.choices.find(
    (candidate): candidate is Extract<PendingChoice, { kind: 'guess' }> =>
      candidate.kind === 'guess' && candidate.card === card,
  );
  return choice?.pack;
};

// ---- Bots ----

export type Ratings = Map<number, number>;

const ranked = (cards: number[], ratings: Ratings) =>
  cards.slice().sort((a, b) => (ratings.get(b) ?? 0) - (ratings.get(a) ?? 0));

const randomOf = <T>(list: T[], rng: () => number): T => list[Math.floor(rng() * list.length)]!;

/**
 * A bot's decision for its task. `ratings` are the model's ratings for the cards in
 * its pack. Plausible rather than optimal.
 */
export const botDecision = (
  state: EngineState,
  seatIndex: number,
  ctx: EngineContext,
  ratings: Ratings,
  rng: () => number,
): SeatDecision | null => {
  const task = seatTask(state, seatIndex);
  const seat = state.seats[seatIndex]!;
  switch (task.kind) {
    case 'idle':
      return null;
    case 'pass':
      return { kind: 'pass' };
    case 'dredge':
      return { kind: 'dredge', to: task.holders.includes(seatIndex) ? seatIndex : randomOf(task.holders, rng) };
    case 'trash': {
      const pack = state.packs[task.pack]!;
      // Bots have always trashed the card they'd have picked.
      const card = task.random ? randomOf(pack.cards, rng) : ranked(pack.cards, ratings)[0]!;
      return { kind: 'trash', card };
    }
    case 'pick': {
      const pack = state.packs[task.pack]!;
      if (task.random) {
        const card = randomOf(pack.cards, rng);
        return { kind: 'pick', cards: [card], remove: botRemoves(seat, ctx, pack, card) ? [card] : [] };
      }
      const order = ranked(pack.cards, ratings);
      const rating = (card: number | undefined) => (card === undefined ? 0 : (ratings.get(card) ?? 0));
      const top = rating(order[0]);

      const agent = faceUpWith(seat, ctx, ['agent'])[0];
      if (agent !== undefined && !seat.agentUsedRound && pack.cards.length >= 10 && pack.cards.length === pack.size) {
        return { kind: 'takeAll', agent, order };
      }

      const cards = [order[0]!];
      const librarians: number[] = [];
      const operatives: number[] = [];
      if (top > 0) {
        for (const librarian of faceUpWith(seat, ctx, ['librarian'])) {
          const next = order[cards.length];
          if (pack.cards.length >= 3 && next !== undefined && rating(next) >= 0.85 * top) {
            cards.push(next);
            librarians.push(librarian);
          }
        }
        for (const operative of faceUpWith(seat, ctx, ['operative'])) {
          const next = order[cards.length];
          if (pack.cards.length >= 8 && seat.skipsOwed === 0 && next !== undefined && rating(next) >= 0.9 * top) {
            cards.push(next);
            operatives.push(operative);
          }
        }
      }
      const remove = cards.filter((card) => botRemoves(seat, ctx, pack, card));
      return { kind: 'pick', cards, remove, librarians, operatives };
    }
    default:
      return null;
  }
};

// Late in a pack, when what's left is unlikely to make the deck, bots with a
// Cogwork Grinder remove the pick; with Animus of Predation, creatures with keywords.
const botRemoves = (seat: EngineSeat, ctx: EngineContext, pack: EnginePack, card: number) => {
  if (pack.cards.length > 5) return false;
  if (faceUpWith(seat, ctx, ['grinder']).length > 0) return true;
  if (faceUpWith(seat, ctx, ['animus']).length > 0) {
    const details = ctx.cards[card];
    return (
      isCreature(details) && (details?.details?.keywords ?? []).some((keyword) => ANIMUS_KEYWORDS.includes(keyword))
    );
  }
  return false;
};

const colorCounts = (seat: EngineSeat, ctx: EngineContext) => {
  const counts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const card of seat.pool) {
    const details = ctx.cards[card];
    if (!details) continue;
    for (const color of cardColors(details)) {
      if (counts[color] !== undefined) counts[color] += 1;
    }
  }
  return counts;
};

const pickColor = (counts: Record<string, number>, taken: string[], most: boolean) => {
  const options = COLORS.filter((color) => !taken.includes(color));
  return options.reduce((best, color) =>
    most ? (counts[color]! > counts[best]! ? color : best) : counts[color]! < counts[best]! ? color : best,
  );
};

/** A bot's answer to a pending choice it has to make, or null if it isn't the bot's to make. */
export const botChoice = (
  state: EngineState,
  seatIndex: number,
  ctx: EngineContext,
  rng: () => number,
): ChoiceEntry | null => {
  const choice = state.choices[0];
  if (!choice) return null;
  switch (choice.kind) {
    case 'lore':
      return choice.seat === seatIndex ? { kind: 'lore', seat: seatIndex, card: choice.card, add: true } : null;
    case 'guess': {
      if (choice.seat !== seatIndex) return null;
      const pack = state.packs[choice.pack];
      if (!pack || pack.cards.length === 0) return { kind: 'guess', seat: seatIndex, card: choice.card, guess: -1 };
      return { kind: 'guess', seat: seatIndex, card: choice.card, guess: randomOf(pack.cards, rng) };
    }
    case 'colors': {
      const chooser = choice.choosers[choice.colors.length];
      if (chooser !== seatIndex) return null;
      const city = ctx.effectOf(choice.card)?.id === 'palianoCity';
      const own = chooser === choice.seat;
      // Paliano: the drafter wants their own colors, neighbors want to give the least useful one.
      // Regicide: everyone keeps their own colors off the list.
      const counts = colorCounts(state.seats[city && !own ? choice.seat : chooser]!, ctx);
      const color = pickColor(counts, choice.colors, city && own);
      return { kind: 'color', seat: seatIndex, card: choice.card, color };
    }
    default:
      return null;
  }
};

/** Cards a bot arms as soon as it has them (they note the next card that fits). */
export const botArms = (state: EngineState, seatIndex: number, ctx: EngineContext): ChoiceEntry[] => {
  const seat = state.seats[seatIndex];
  if (!seat) return [];
  return faceUpWith(seat, ctx, ['banneret', 'vanguard', 'smuggler'])
    .filter((card) => !seat.armed.includes(card))
    .map((card) => ({ kind: 'arm', seat: seatIndex, card, on: true }));
};

// ---- Notes ----

// How draft-matters text names a seat. Seat names are deck names, which change as the
// bots draft (a bot with no colored cards yet is "C"), so they aren't used.
export const seatLabel = (seat: number): string => `Seat ${seat + 1}`;

export const noteText = (note: DraftNote, seatName: (seat: number) => string, cards: Card[]): string => {
  switch (note.kind) {
    case 'pick':
      return `Pick ${note.n}`;
    case 'seat':
      return `Passed by ${seatName(note.seat)}`;
    case 'name':
      return `Noted: ${cards[note.card] ? cardName(cards[note.card]!) : 'unknown card'}`;
    case 'types':
      return note.types.length > 0 ? `Types: ${note.types.join(', ')}` : 'Types: none';
    case 'colors':
      return `Colors: ${note.colors.join(' ')}`;
    case 'keywords':
      return `Keywords: ${note.keywords.join(', ')}`;
    case 'guess':
      return note.right ? 'Guessed right' : 'Guessed wrong';
    default:
      return '';
  }
};

// ---- Replay ----

export interface ReplayAction {
  seat: number;
  round: number;
  // The seat's pick number this round for the first card of the action (for a dredge,
  // the receiving seat's).
  pick: number;
  kind: 'pick' | 'trash' | 'takeAll' | 'pass' | 'dredge';
  // The pack as the seat saw it.
  cardsInPack: number[];
  packId: number;
  loreSource: number | null;
  blind: boolean;
  random: boolean;
  // Cards that came out of the pack, in order.
  cards: number[];
  removed: number[];
  librarians: number[];
  operatives: number[];
  // takeAll: the Agent of Acquisitions used.
  agent?: number;
  // dredge: who got the last card.
  to?: number;
}

/**
 * Re-runs a logged draft, returning every action of every seat in order (and the
 * final state). Only decisions are replayed, so it doesn't depend on randomness.
 */
export const replayLog = (
  draft: Draft,
  ctx: EngineContext = engineContext(draft),
): { actions: ReplayAction[]; state: EngineState } => {
  let state = createEngineState(draft.seats.length, ctx);
  const actions: ReplayAction[] = [];
  for (const entry of draft.DraftLog ?? []) {
    if ('d' in entry) {
      state.seats.forEach((_, seatIndex) => {
        const task = seatTask(state, seatIndex);
        const decision = entry.d[seatIndex];
        if (task.kind === 'idle' || !decision) return;
        const pack = state.packs[task.pack]!;
        const base = {
          seat: seatIndex,
          round: state.round,
          pick: state.seats[seatIndex]!.draftedThisRound + 1,
          cardsInPack: pack.cards.slice(),
          packId: pack.id,
          loreSource: pack.loreSource,
          blind: task.kind === 'pick' && task.blind,
          random: (task.kind === 'pick' || task.kind === 'trash') && task.random,
          removed: [] as number[],
          librarians: [] as number[],
          operatives: [] as number[],
        };
        switch (decision.kind) {
          case 'pick':
            actions.push({
              ...base,
              kind: 'pick',
              cards: decision.cards,
              removed: decision.remove ?? [],
              librarians: decision.librarians ?? [],
              operatives: decision.operatives ?? [],
            });
            break;
          case 'trash':
            actions.push({ ...base, kind: 'trash', cards: [decision.card] });
            break;
          case 'takeAll':
            actions.push({ ...base, kind: 'takeAll', cards: decision.order, agent: decision.agent });
            break;
          case 'pass':
            actions.push({ ...base, kind: 'pass', cards: [] });
            break;
          case 'dredge':
            // Numbered as the receiving seat's pick, since that's whose breakdown shows it.
            actions.push({
              ...base,
              pick: (state.seats[decision.to]?.draftedThisRound ?? 0) + 1,
              kind: 'dredge',
              cards: pack.cards.slice(0, 1),
              to: decision.to,
            });
            break;
          default:
            break;
        }
      });
      state = applyTick(state, entry.d, ctx).state;
    } else {
      state = applyChoice(state, entry.c, ctx).state;
    }
  }
  return { actions, state };
};

export interface ReplayCardAction {
  action: 'pick' | 'trash';
  selection: number;
  cardsInPack: number[];
  pack: number;
  pick: number;
  // Cards already in the seat's pool before this one.
  picked: number[];
  // How the card came out of the pack.
  via: 'pick' | 'extra' | 'takeAll' | 'received' | 'removed' | 'blind' | 'random' | 'trash';
  // The card whose ability made this happen (Librarian, Operative, Agent).
  source?: number;
  // received: the seat that passed it.
  from?: number;
  // Drafted from a pack a Lore Seeker added.
  loreSource: number | null;
}

/**
 * One entry per card a seat drafted or trashed, in order, with the pack as it looked
 * when that card came out of it. Cards received from a Canal Dredger count for the
 * seat that got them.
 */
export const seatCardActions = (draft: Draft, seatIndex: number): ReplayCardAction[] => {
  const { actions } = replayLog(draft);
  const out: ReplayCardAction[] = [];
  const picked: number[] = [];
  for (const action of actions) {
    const mine = action.kind === 'dredge' ? action.to === seatIndex : action.seat === seatIndex;
    if (!mine || action.kind === 'pass') continue;
    const pack = action.cardsInPack.slice();
    const extras = [...action.librarians, ...action.operatives];
    action.cards.forEach((card, index) => {
      let via: ReplayCardAction['via'] = 'pick';
      if (action.kind === 'trash') via = 'trash';
      else if (action.kind === 'takeAll') via = 'takeAll';
      else if (action.kind === 'dredge') via = 'received';
      else if (action.removed.includes(card)) via = 'removed';
      else if (index > 0) via = 'extra';
      else if (action.blind) via = 'blind';
      else if (action.random) via = 'random';
      out.push({
        action: action.kind === 'trash' ? 'trash' : 'pick',
        selection: card,
        cardsInPack: pack.slice(),
        pack: action.round,
        pick: action.pick + index,
        picked: picked.slice(),
        via,
        source: action.kind === 'takeAll' ? action.agent : index > 0 ? extras[index - 1] : undefined,
        from: action.kind === 'dredge' ? action.seat : undefined,
        loreSource: action.loreSource,
      });
      removeFrom(pack, card);
      if (action.kind !== 'trash' && !action.removed.includes(card)) picked.push(card);
    });
  }
  return out;
};

export const hasDraftLog = (draft: Draft) => Array.isArray(draft.DraftLog) && draft.DraftLog.length > 0;
