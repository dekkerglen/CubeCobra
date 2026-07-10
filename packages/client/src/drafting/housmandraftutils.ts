import { isVoucher } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import Draft, { HousmanLogEntry } from '@utils/datatypes/Draft';
import DraftSeat from '@utils/datatypes/DraftSeat';
import { getDefaultPosition } from '@utils/draftutil';

import DraftLocation, { addCard } from './DraftLocation';

export type { HousmanLogEntry };

// Standard Housman Draft parameters. These mirror the fixed values used by the
// start route on the server; only player count and round count are configurable.
export const HAND_SIZE = 5;
export const FACE_UP = 9;
export const EXCHANGES = 3;

export interface HousmanState {
  round: number; // 0-based index of the current round
  numRounds: number;
  numPlayers: number;
  hands: number[][]; // hands[seat] = card indices currently held (hidden per player)
  pool: number[]; // shared face-up pool of card indices (mutated by exchanges)
  exchangesMade: number[]; // exchangesMade[seat] this round, 0..EXCHANGES
  firstPlayer: number; // seat that exchanges first this round (rotates each round)
  turn: number; // seat whose exchange it is right now
  done: boolean; // true once every round is complete
  seats: DraftSeat[]; // accumulating result: mainboard + pickorder per seat
  // Cumulative set of every card index that has ever been face-up in a shared pool (each
  // round's initial pool plus every card given during an exchange). A card that is not the
  // viewer's own is only identifiable — in an opponent's hand or drafted pool — if it is
  // here; everything else stays hidden (shown as a card back). Once seen, always known.
  seen: number[];
  log: HousmanLogEntry[]; // most-recent-last history of exchanges
}

// Append the given indices that aren't already present. Returns a new array (or the same
// reference when nothing changes) to keep reducer updates cheap and pure.
const addSeen = (seen: number[], indices: number[]): number[] => {
  const missing = indices.filter((idx) => !seen.includes(idx));
  return missing.length > 0 ? seen.concat(missing) : seen;
};

// Deal one round from InitialState: the first HAND_SIZE * numPlayers indices become the
// players' hands (HAND_SIZE per seat, in seat order); the remaining FACE_UP form the pool.
export const dealRound = (
  initialState: number[][],
  round: number,
  numPlayers: number,
): { hands: number[][]; pool: number[] } => {
  const cardsForRound = initialState[round] ?? [];
  const hands: number[][] = [];
  for (let seat = 0; seat < numPlayers; seat++) {
    hands.push(cardsForRound.slice(seat * HAND_SIZE, (seat + 1) * HAND_SIZE));
  }
  const pool = cardsForRound.slice(numPlayers * HAND_SIZE, numPlayers * HAND_SIZE + FACE_UP);
  return { hands, pool };
};

// A cheap deep copy of the 3D mainboard/sideboard structure so reducer updates stay pure.
const cloneBoard = (board: number[][][]): number[][][] => board.map((row) => row.map((col) => [...col]));

const cloneSeat = (seat: DraftSeat): DraftSeat => ({
  ...seat,
  mainboard: cloneBoard(seat.mainboard),
  sideboard: cloneBoard(seat.sideboard),
  pickorder: [...(seat.pickorder ?? [])],
});

export const initHousmanState = (draft: Draft): HousmanState => {
  const initialState = (draft.InitialState ?? []) as unknown as number[][];
  const numPlayers = draft.seats.length;
  const { hands, pool } = dealRound(initialState, 0, numPlayers);
  return {
    round: 0,
    numRounds: initialState.length,
    numPlayers,
    hands,
    pool,
    exchangesMade: new Array(numPlayers).fill(0),
    firstPlayer: 0,
    turn: 0,
    done: false,
    seats: draft.seats.map(cloneSeat),
    seen: [...pool],
    log: [],
  };
};

// Fold a seat's final 5-card hand into its mainboard (CMC columns) and pickorder.
const keepHand = (seat: DraftSeat, hand: number[], cards: Card[]): void => {
  for (const cardIndex of hand) {
    seat.pickorder?.push(cardIndex);
    const pos = getDefaultPosition(cards[cardIndex]!, seat.mainboard);
    seat.mainboard = addCard(seat.mainboard, DraftLocation.deck(pos[0], pos[1], pos[2]), cardIndex);
  }
};

export interface HousmanExchange {
  seat: number;
  handCard: number; // card index leaving the seat's hand (goes face-up into the pool)
  poolCard: number; // card index taken from the pool into the seat's hand
}

// Apply a single exchange and, if that completes the round, fold hands into pools and deal
// the next round (or finish). Pure: returns a new state and never mutates the input.
export const applyExchange = (
  state: HousmanState,
  { seat, handCard, poolCard }: HousmanExchange,
  cards: Card[],
  initialState: number[][],
): HousmanState => {
  if (state.done || seat !== state.turn || state.exchangesMade[seat]! >= EXCHANGES) {
    return state;
  }
  if (!state.hands[seat]!.includes(handCard) || !state.pool.includes(poolCard)) {
    return state;
  }

  const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => c !== handCard).concat(poolCard) : [...h]));
  const pool = state.pool.filter((c) => c !== poolCard).concat(handCard);
  const exchangesMade = [...state.exchangesMade];
  exchangesMade[seat] = exchangesMade[seat]! + 1;

  // The given card is now face-up in the pool, so it becomes public knowledge; the taken
  // card was already public. Record the swap so everyone can follow what happened.
  const seen = addSeen(state.seen, [handCard]);
  const log = state.log.concat({ seat, round: state.round, given: handCard, taken: poolCard });

  const roundComplete = exchangesMade.every((count) => count >= EXCHANGES);

  if (!roundComplete) {
    // Advance to the next seat (cycling) that still owes exchanges this round.
    let next = (seat + 1) % state.numPlayers;
    while (exchangesMade[next]! >= EXCHANGES) {
      next = (next + 1) % state.numPlayers;
    }
    return { ...state, hands, pool, exchangesMade, turn: next, seen, log };
  }

  // Round complete: every player keeps their final hand; the face-up pool is discarded.
  const seats = state.seats.map(cloneSeat);
  for (let s = 0; s < state.numPlayers; s++) {
    keepHand(seats[s]!, hands[s]!, cards);
  }

  const nextRound = state.round + 1;
  if (nextRound >= state.numRounds) {
    return { ...state, hands, pool, exchangesMade, seats, done: true, seen, log };
  }

  const { hands: nextHands, pool: nextPool } = dealRound(initialState, nextRound, state.numPlayers);
  const firstPlayer = (state.firstPlayer + 1) % state.numPlayers;
  return {
    ...state,
    round: nextRound,
    hands: nextHands,
    pool: nextPool,
    exchangesMade: new Array(state.numPlayers).fill(0),
    firstPlayer,
    turn: firstPlayer,
    seats,
    // The next round's pool is dealt face-up, so those cards become public too.
    seen: addSeen(seen, nextPool),
    log,
  };
};

const getCardElo = (index: number | undefined, cards: Card[]): number => {
  if (index === undefined || index === null) return 0;
  const card = cards[index];
  if (!card) return 0;

  if (isVoucher(card)) {
    const anyCard = card as any;
    if (anyCard.voucher_card_indices?.length > 0) {
      return anyCard.voucher_card_indices.reduce(
        (sum: number, idx: number) => sum + (cards[idx]?.details?.elo || 0),
        0,
      );
    }
    if (anyCard.voucher_cards?.length > 0) {
      return anyCard.voucher_cards.reduce((sum: number, vc: any) => sum + (vc.details?.elo || 0), 0);
    }
  }

  return card.details?.elo || 0;
};

// A bot must exchange every turn. Greedy heuristic: take the highest-Elo card from the pool
// and give up the lowest-Elo card in hand. When the pool holds an upgrade this improves the
// hand; when it doesn't, it still surrenders the least valuable card (the mandatory minimum).
export const calculateHousmanBotExchange = (hand: number[], pool: number[], cards: Card[]): HousmanExchange | null => {
  if (hand.length === 0 || pool.length === 0) {
    return null;
  }

  let poolCard = pool[0]!;
  let bestPoolElo = getCardElo(poolCard, cards);
  for (const index of pool) {
    const elo = getCardElo(index, cards);
    if (elo > bestPoolElo) {
      bestPoolElo = elo;
      poolCard = index;
    }
  }

  let handCard = hand[0]!;
  let worstHandElo = getCardElo(handCard, cards);
  for (const index of hand) {
    const elo = getCardElo(index, cards);
    if (elo < worstHandElo) {
      worstHandElo = elo;
      handCard = index;
    }
  }

  return { seat: -1, handCard, poolCard };
};

// One reconstructed exchange for the post-draft breakdown. `poolBefore` is the shared pool
// exactly as it looked when the seat acted (after all earlier exchanges that round), and
// `handAfter` is the seat's hand once this exchange resolved.
export interface HousmanStep {
  round: number; // 0-based
  seat: number;
  seatExchange: number; // 1-based: which of this seat's exchanges this round
  given: number;
  taken: number;
  poolBefore: number[];
  handAfter: number[];
}

// Replay a completed draft's exchange log into per-exchange snapshots. The log is stored in
// draft order and grouped by round, so we re-deal the pool/hands at each round boundary and
// apply each exchange in sequence — the same evolution players saw live.
export const buildHousmanSteps = (draft: Draft): HousmanStep[] => {
  const initialState = (draft.InitialState ?? []) as unknown as number[][];
  const log = draft.HousmanLog ?? [];
  const numPlayers = draft.seats.length;

  const steps: HousmanStep[] = [];
  let curRound = -1;
  let pool: number[] = [];
  let hands: number[][] = [];
  let seatCounts: number[] = [];

  for (const entry of log) {
    if (entry.round !== curRound) {
      curRound = entry.round;
      const dealt = dealRound(initialState, curRound, numPlayers);
      pool = dealt.pool.slice();
      hands = dealt.hands.map((h) => h.slice());
      seatCounts = new Array(numPlayers).fill(0);
    }

    const poolBefore = pool.slice();
    seatCounts[entry.seat] = (seatCounts[entry.seat] ?? 0) + 1;

    pool = pool.filter((c) => c !== entry.taken).concat(entry.given);
    hands[entry.seat] = (hands[entry.seat] ?? []).filter((c) => c !== entry.given).concat(entry.taken);

    steps.push({
      round: entry.round,
      seat: entry.seat,
      seatExchange: seatCounts[entry.seat]!,
      given: entry.given,
      taken: entry.taken,
      poolBefore,
      handAfter: hands[entry.seat]!.slice(),
    });
  }

  return steps;
};
