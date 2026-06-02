/**
 * Manabase Trim
 * =============
 *
 * Shared between the browser-side simulator and the server-side bot deckbuilder.
 *
 * Runs after the mainboard has been filled to target size, but before basics are added.
 * Its job is narrow: reconsider suspicious nonbasic lands and decide whether they should
 * stay, be replaced by a basic immediately, or be adjudicated by the draft model. This is
 * not a general "cut the worst cards" pass; phase 2 still owns normal deck composition.
 *
 * High-level flow
 * ---------------
 *
 * The trim has two stages:
 *   1. One heuristic screen up front:
 *      - clearly useful lands are left alone (`mustKeep`)
 *      - clearly bad lands are force-cut to basics
 *      - everything else becomes an ambiguous ML candidate
 *   2. Draft-model adjudication for that ambiguous remainder:
 *      - ask "would I rather have the best basic here?"
 *      - keep the land when the answer is no
 *      - cut it to that basic when the answer is yes
 *
 * Current must-keep buckets
 * -------------------------
 *
 *   - Typed lands with 2+ on-color basic land subtypes.
 *     Example: Ketria Triome in UG.
 *   - Fetchlands whose `evaluateFetch()` result is `real`.
 *     Example: Polluted Delta in UB with Underground Sea, or Flooded Strand in UW when
 *     the deck is predicted to run both Plains and Island basics.
 *
 * Current force-cut buckets
 * -------------------------
 *
 *   - Typed lands with fewer than 2 on-color subtypes.
 *     Example: Scrubland in mono-W.
 *   - Fetchlands whose `evaluateFetch()` result is `dead`.
 *     Example: Marsh Flats in mono-U with no Plains or Swamp targets.
 *   - Lands whose every colored requirement is off-color for the deck.
 *     Example: Unholy Grotto in mono-W.
 *   - Multi-color producers where fewer than 2 produced colors are on-color.
 *     Example: Adarkar Wastes in mono-W.
 *   - Single-color producers the deck barely supports.
 *     Example: Valakut in a light red splash.
 *
 *
 * ML stage
 * --------
 *
 * The ML stage is one batched draft rerank over all ambiguous lands. Each candidate gets a
 * tiny "pack" containing the land plus the available basic replacements, and we compare the
 * best basic's rating against the land's rating directly.
 *
 * Where the logic lives
 * ---------------------
 *
 *   landTrim.ts           — orchestration for the heuristic screen plus draft-model gate.
 *   manabaseBasics.ts     — shared basic allocation / predicted basics.
 *   manabaseFetch.ts      — fetch evaluation, typeline subtype parsing, shuffle-synergy.
 *   manabaseLandRules.ts  — must-keeps, suspect checks, force-cuts, and basic replacements.
 *   manabaseShared.ts     — shared types and low-level helpers.
 *   manabaseHeuristics.ts — compatibility barrel re-exporting the modules above.
 *
 * The rerank callback is supplied by the caller because client and server speak to the
 * draft model over different channels — `localBatchDraftRanked` over WebGL in the browser,
 * `batchDraftOrThrow` over HTTP in the server.
 */

import {
  assessDeckMainColors,
  type BasicCardLike,
  type LandMetaLookup,
  oracleIsForceCutLand,
  oracleIsMustKeepNonbasicLand,
  oracleIsSuspectNonbasicLand,
  pickForceCutBasic,
} from './manabaseHeuristics';

export type LandTrimRerank = (
  inputs: { pack: string[]; pool: string[] }[],
) => Promise<{ oracle: string; rating: number }[][]>;

/** One deck's view into the trim. The caller passes mainboard / sideboard arrays it owns,
 *  and the trim mutates them in place: cut lands move out of `mainboard` and into
 *  `sideboard`, and the swapped-in basic takes the cut land's slot so the mainboard size is
 *  preserved. `originalPool` is the set of oracles that were actually drafted; trim only
 *  considers cards in this set so it can't accidentally cut a basic injected by a previous
 *  force-cut or by an upstream caller that pre-seeded the mainboard with basics. */
export interface LandTrimDeck {
  mainboard: string[];
  sideboard: string[];
  basics: BasicCardLike[];
  deckSize: number;
  /** Target land count for this deck (typically 17 for 40-card draft, 40 for 99-card
   *  commander). Kept on the trim input shape for alignment with deckbuilding state. */
  maxLands: number;
  cardMeta: LandMetaLookup;
  originalPool: Iterable<string>;
}

export interface LandTrimOptions {
  signal?: AbortSignal;
}

type TrimState = {
  deck: LandTrimDeck;
  basicCandidates: string[];
  originalPoolSet: Set<string>;
  protectedLands: Set<string>;
};

type Candidate = { state: TrimState; cutOracle: string };
type ForceCut = { state: TrimState; cutOracle: string; addOracle: string };
type HeuristicPartition = { forceCuts: ForceCut[]; candidates: Candidate[] };

/** Shared mutation hook for the trim run. Keeping swap application in one place avoids
 *  subtle divergence between heuristic cuts and ML-approved cuts. */
type TrimContext = {
  applySwap: (state: TrimState, cutOracle: string, addOracle: string) => void;
};

function createTrimContext(): TrimContext {
  const applySwap: TrimContext['applySwap'] = (state, cutOracle, addOracle) => {
    const cutIndex = state.deck.mainboard.indexOf(cutOracle);
    if (cutIndex < 0) return;
    state.deck.mainboard.splice(cutIndex, 1, addOracle);
    state.deck.sideboard.push(cutOracle);
  };
  return { applySwap };
}

const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw new DOMException('Operation aborted', 'AbortError');
};

/** One-time heuristic partition for a deck's removable lands:
 *    - must-keep: heuristic says "leave this alone"
 *    - force-cut: heuristic says "replace with a basic immediately"
 *    - candidate: heuristic says "ask the ML second opinion"
 *  Lands that are `mustKeep` or non-suspect are ignored here and never enter trim. */
function classifySuspects(state: TrimState): HeuristicPartition {
  const mainDeckColors = assessDeckMainColors(state.deck.mainboard, state.deck.cardMeta);
  const removable = [...new Set(state.deck.mainboard)].filter((oracle) => {
    if (!state.originalPoolSet.has(oracle)) return false;
    if (state.protectedLands.has(oracle)) return false;
    if (
      oracleIsMustKeepNonbasicLand(
        oracle,
        mainDeckColors,
        state.deck.cardMeta,
        state.deck.mainboard,
        state.deck.basics,
        state.deck.deckSize,
      )
    ) {
      return false;
    }
    return oracleIsSuspectNonbasicLand(
      oracle,
      mainDeckColors,
      state.deck.cardMeta,
      state.deck.mainboard,
      state.deck.basics,
      state.deck.deckSize,
    );
  });
  if (removable.length === 0 || state.basicCandidates.length === 0) return { forceCuts: [], candidates: [] };

  const forceCuts: ForceCut[] = [];
  const candidates: Candidate[] = [];
  for (const cutOracle of removable) {
    const isForceCut = oracleIsForceCutLand(
      cutOracle,
      mainDeckColors,
      state.deck.cardMeta,
      state.deck.mainboard,
      state.deck.basics,
      state.deck.deckSize,
    );
    if (isForceCut) {
      const addOracle = pickForceCutBasic(cutOracle, mainDeckColors, state.deck.cardMeta, state.deck.basics);
      if (addOracle) {
        forceCuts.push({ state, cutOracle, addOracle });
        continue;
      }
    }
    candidates.push({ state, cutOracle });
  }
  return { forceCuts, candidates };
}

/** Run the draft-model second opinion for all ambiguous candidates.
 *  gain = best basic rating - cut land rating
 *  gain <= 0 means "keep the land"
 *  gain > 0 means "swap in the best basic". */
async function runDraftRerank(
  candidates: Candidate[],
  rerank: LandTrimRerank,
  signal: AbortSignal | undefined,
  ctx: TrimContext,
): Promise<void> {
  const batchInputs = candidates.map((candidate) => {
    const reduced = [...candidate.state.deck.mainboard];
    const idx = reduced.indexOf(candidate.cutOracle);
    if (idx >= 0) reduced.splice(idx, 1);
    return { pack: [candidate.cutOracle, ...candidate.state.basicCandidates], pool: reduced };
  });
  const reranks = await rerank(batchInputs);
  throwIfAborted(signal);

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i]!;
    const pairRanking = reranks[i] ?? [];
    const basicOracles = new Set(candidate.state.basicCandidates);
    const cutScore = pairRanking.find((item) => item.oracle === candidate.cutOracle)?.rating;
    const bestBasic = pairRanking.find((item) => basicOracles.has(item.oracle));
    if (cutScore === undefined || !bestBasic) {
      candidate.state.protectedLands.add(candidate.cutOracle);
      continue;
    }
    const gain = bestBasic.rating - cutScore;
    if (gain <= 0) {
      candidate.state.protectedLands.add(candidate.cutOracle);
      continue;
    }
    ctx.applySwap(candidate.state, candidate.cutOracle, bestBasic.oracle);
  }
}

/** Apply the one-time heuristic screen across all decks, mutating force-cuts immediately and
 *  returning the ambiguous remainder for draft-model adjudication. */
function applyHeuristicScreen(states: TrimState[]): { ctx: TrimContext; candidates: Candidate[] } {
  const allForceCuts: ForceCut[] = [];
  const allCandidates: Candidate[] = [];
  for (const state of states) {
    const classified = classifySuspects(state);
    allForceCuts.push(...classified.forceCuts);
    allCandidates.push(...classified.candidates);
  }

  const ctx = createTrimContext();
  for (const forceCut of allForceCuts) ctx.applySwap(forceCut.state, forceCut.cutOracle, forceCut.addOracle);
  return { ctx, candidates: allCandidates };
}

export async function runManabaseTrim(
  decks: LandTrimDeck[],
  rerank: LandTrimRerank,
  options: LandTrimOptions = {},
): Promise<void> {
  const signal = options.signal;

  const states: TrimState[] = decks.map((deck) => ({
    deck,
    basicCandidates: [...new Set(deck.basics.map((basic) => basic.oracleId))],
    originalPoolSet: new Set<string>(deck.originalPool),
    protectedLands: new Set<string>(),
  }));

  throwIfAborted(signal);
  const { ctx, candidates } = applyHeuristicScreen(states);
  if (candidates.length === 0) return;
  await runDraftRerank(candidates, rerank, signal, ctx);
}
