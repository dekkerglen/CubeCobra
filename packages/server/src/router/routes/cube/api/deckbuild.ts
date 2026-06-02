import { type LandTrimDeck, runManabaseTrim } from '@utils/drafting/landTrim';
import type { BasicCardLike } from '@utils/drafting/manabaseHeuristics';
import { randomUUID } from 'crypto';
import { buildLandMetaLookup } from 'serverutils/buildLandMetaLookup';
import carddb, { cardFromId, getOracleForMl, getReasonableCardByOracle } from 'serverutils/carddb';
import { calculateBasics, deckbuild } from 'serverutils/draftbots';
import { batchDraftOrThrow, buildOrThrow, draftOrThrow } from 'serverutils/ml';

import { Request, Response } from '../../../../types/express';

// ---------------------------------------------------------------------------
// Synchronous endpoint — kept for public API back-compat (documented at
// /tool/apidocs). The new client deckbuilder uses /start + /step below, which
// is what should be preferred for anything inside this app: one ML call per
// HTTP request, bounded timeouts, and a live progress signal.
// ---------------------------------------------------------------------------

export const deckbuildHandler = async (req: Request, res: Response) => {
  try {
    const { pool, basics, maxSpells, maxLands } = req.body;

    if (!pool || !basics) {
      return res.status(400).send({
        success: 'false',
        message: 'Pool and basics are required',
      });
    }

    const { mainboard, sideboard } = await deckbuild(pool, basics, maxSpells ?? 23, maxLands ?? 17);

    return res.status(200).send({
      success: 'true',
      mainboard,
      sideboard,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    // The deckbuild path can run long enough that the ELB / client closes the
    // socket before we resolve. By that point either the success res.send()
    // already fired or the connection is gone; calling .send again here just
    // produces ERR_HTTP_HEADERS_SENT spam in the unhandled-rejection log.
    if (res.headersSent) return;
    return res.status(500).send({
      success: 'false',
    });
  }
};

// ---------------------------------------------------------------------------
// Stepwise deckbuild — one ML call per HTTP request.
//
// Mirrors /draft/deckbuild/start|step which builds bot decks at the end of a
// draft. The session lives in memory keyed by a server-generated sessionId
// (so untrusted clients can't iterate other users' sessions), and is scoped
// to req.user.id.
//
// Why split it: a single deckbuild was making 1 batchBuild + ~23 sequential
// draft picks server-side under one HTTP request. With even a small per-call
// retry budget that easily exceeded ELB timeouts and produced ERR_HTTP_HEADERS_SENT
// races. Stepwise keeps each individual call short and lets the client show
// progress.
// ---------------------------------------------------------------------------

interface DeckbuildSessionState {
  userId: string;
  basicsCards: any[]; // CardDetails for the cube basics
  maxSpells: number;
  maxLands: number;
  deckSize: number;
  // Original-oracle <-> ML-oracle substitution map (multiple originals can
  // collapse to the same ML oracle when the model doesn't know a card).
  toMl: Record<string, string>;
  fromMl: Record<string, string[]>;
  mainboard: string[]; // oracle IDs
  remainingPool: string[]; // oracle IDs (multiset; one entry per copy)
  deckCopies: Record<string, number>;
  spellCount: number;
  landCount: number;
  step: number;
  totalSteps: number;
  complete: boolean;
  result: { mainboard: string[]; sideboard: string[] } | null;
  createdAt: number;
}

const SESSION_TTL_MS = 5 * 60 * 1000;
const sessions = new Map<string, DeckbuildSessionState>();

// Drop sessions older than 5 minutes so a forgotten in-progress build can't
// leak memory.
setInterval(() => {
  const now = Date.now();
  for (const [key, s] of sessions.entries()) {
    if (now - s.createdAt > SESSION_TTL_MS) sessions.delete(key);
  }
}, 60 * 1000);

const oracleIsLand = (oracle: string): boolean => {
  const oracleIds = carddb.oracleToId[oracle];
  return !!(oracleIds && oracleIds[0] && cardFromId(oracleIds[0]).type.includes('Land'));
};

// Conspiracy and Vanguard cards are draft-affecting cards that should never
// be selected for a bot's mainboard. They remain in the sideboard.
const oracleIsConspiracyOrVanguard = (oracle: string): boolean => {
  const oracleIds = carddb.oracleToId[oracle];
  if (!oracleIds || !oracleIds[0]) return false;
  const type = cardFromId(oracleIds[0]).type || '';
  return type.includes('Conspiracy') || type.includes('Vanguard');
};

// Convert internal session state to the deck shape callers want, filling
// remaining mainboard slots with basics chosen by mana-source heuristic.
const finalize = async (s: DeckbuildSessionState): Promise<{ mainboard: string[]; sideboard: string[] }> => {
  const trimDecks: LandTrimDeck[] = [
    {
      mainboard: s.mainboard,
      sideboard: s.remainingPool,
      basics: s.basicsCards
        .filter((b: any) => b?.oracle_id)
        .map<BasicCardLike>((b: any) => ({ oracleId: b.oracle_id, colorIdentity: b.color_identity ?? [] })),
      deckSize: s.deckSize,
      maxLands: s.maxLands,
      cardMeta: buildLandMetaLookup(s.mainboard, s.basicsCards),
      originalPool: [...s.mainboard, ...s.remainingPool],
    },
  ];
  try {
    await runManabaseTrim(trimDecks, batchDraftOrThrow);
  } catch (err) {
    // Finalize the untrimmed deck rather than failing the request, but record the failure
    // so a wedged rerank service is visible in logs.
    console.warn('cube/api/deckbuild manabase trim failed; finalizing without trim', err);
  }

  const mainboardCards = s.mainboard.map(getReasonableCardByOracle);
  const basicsToAdd = calculateBasics(mainboardCards, s.basicsCards, s.deckSize);
  const mainboardOracles = [
    ...s.mainboard.filter(Boolean),
    ...basicsToAdd.map((card: any) => card.oracle_id).filter(Boolean),
  ];
  return {
    mainboard: mainboardOracles.sort(),
    sideboard: s.remainingPool.filter(Boolean).slice().sort(),
  };
};

// POST /cube/api/deckbuild/start
// Body: { pool: CardDetails[], basics: CardDetails[], maxSpells?, maxLands? }
// Runs Phase 1 (single ML build call) and returns a sessionId. The client
// then calls /step in a loop using that sessionId until { complete: true }.
export const startHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { pool, basics, maxSpells: rawMaxSpells, maxLands: rawMaxLands } = req.body ?? {};
    if (!Array.isArray(pool) || !Array.isArray(basics)) {
      return res.status(400).json({ success: false, message: 'pool and basics are required' });
    }

    const maxSpells = typeof rawMaxSpells === 'number' && rawMaxSpells > 0 ? rawMaxSpells : 23;
    const maxLands = typeof rawMaxLands === 'number' && rawMaxLands > 0 ? rawMaxLands : 17;
    const deckSize = maxSpells + maxLands;

    const poolOracles: string[] = pool
      .map((card: any) => card?.oracle_id)
      .filter((id: any): id is string => typeof id === 'string' && id.length > 0);

    const basicsCards = basics.filter(Boolean);

    if (poolOracles.length === 0) {
      // Nothing to build from — return an empty deck immediately so the client
      // doesn't have to handle this edge case in the step loop.
      const sessionId = randomUUID();
      const empty: DeckbuildSessionState = {
        userId: req.user.id,
        basicsCards,
        maxSpells,
        maxLands,
        deckSize,
        toMl: {},
        fromMl: {},
        mainboard: [],
        remainingPool: [],
        deckCopies: {},
        spellCount: 0,
        landCount: 0,
        step: 1,
        totalSteps: 1,
        complete: true,
        result: { mainboard: [], sideboard: [] },
        createdAt: Date.now(),
      };
      sessions.set(sessionId, empty);
      return res.status(200).json({
        success: true,
        sessionId,
        step: 1,
        totalSteps: 1,
        complete: true,
        mainboard: empty.result!.mainboard,
        sideboard: empty.result!.sideboard,
      });
    }

    // Build the original <-> ML oracle map for this pool.
    const toMl: Record<string, string> = {};
    const fromMl: Record<string, string[]> = {};
    for (const oracle of poolOracles) {
      if (toMl[oracle] !== undefined) continue;
      const mlOracle = getOracleForMl(oracle, null);
      toMl[oracle] = mlOracle;
      if (!fromMl[mlOracle]) fromMl[mlOracle] = [];
      if (!fromMl[mlOracle]!.includes(oracle)) fromMl[mlOracle]!.push(oracle);
    }
    const poolMlOracles = poolOracles.map((o) => toMl[o] ?? o);

    // Phase 1: single ML call to seed up to 10 cards. Any error here propagates
    // to the caller — there's no useful partial state to return, and the client
    // will surface the failure to the user. (withMlRetry inside buildOrThrow
    // already gives us a bounded retry budget.)
    const buildResult = await buildOrThrow(poolMlOracles);

    const mainboard: string[] = [];
    const remainingPool = [...poolOracles];
    const deckCopies: Record<string, number> = {};
    let spellCount = 0;
    let landCount = 0;

    for (const item of buildResult) {
      if (mainboard.length >= 10) break;
      const originals = fromMl[item.oracle] ?? [item.oracle];
      const oracle = originals.find((o) => remainingPool.includes(o));
      if (!oracle) continue;

      if (oracleIsConspiracyOrVanguard(oracle)) continue;

      const land = oracleIsLand(oracle);
      if (land && landCount >= maxLands) continue;
      if (!land && spellCount >= maxSpells) continue;

      const poolIdx = remainingPool.indexOf(oracle);
      if (poolIdx === -1) continue;

      const existing = deckCopies[oracle] ?? 0;
      const adjustedRating = item.rating * Math.pow(0.9, existing);
      if (adjustedRating <= 0) continue;

      mainboard.push(oracle);
      deckCopies[oracle] = existing + 1;
      remainingPool.splice(poolIdx, 1);
      if (land) landCount += 1;
      else spellCount += 1;
    }

    const totalSteps = 1 + Math.max(0, deckSize - 10);
    const sessionId = randomUUID();

    const state: DeckbuildSessionState = {
      userId: req.user.id,
      basicsCards,
      maxSpells,
      maxLands,
      deckSize,
      toMl,
      fromMl,
      mainboard,
      remainingPool,
      deckCopies,
      spellCount,
      landCount,
      step: 1,
      totalSteps,
      complete: false,
      result: null,
      createdAt: Date.now(),
    };

    // Possible to already be done after Phase 1 — tiny pools, or every Phase 2
    // candidate already exceeded its category cap.
    const anyActive = mainboard.length < deckSize && remainingPool.length > 0;
    if (!anyActive) {
      state.complete = true;
      state.result = await finalize(state);
      sessions.set(sessionId, state);
      return res.status(200).json({
        success: true,
        sessionId,
        step: 1,
        totalSteps: 1,
        complete: true,
        mainboard: state.result.mainboard,
        sideboard: state.result.sideboard,
      });
    }

    sessions.set(sessionId, state);
    return res.status(200).json({
      success: true,
      sessionId,
      step: 1,
      totalSteps,
      complete: false,
    });
  } catch (err) {
    req.logger.error('Error starting deckbuild', err instanceof Error ? err.stack : String(err));
    if (res.headersSent) return;
    return res.status(500).json({ success: false, message: 'Error starting deckbuild' });
  }
};

// POST /cube/api/deckbuild/step
// Body: { sessionId }
// Runs one Phase 2 ML call against the session, picks the best remaining
// candidate, returns updated progress. When the deck is full (or stuck) the
// response includes the finalized mainboard/sideboard.
export const stepHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const sessionId = req.body?.sessionId;
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      return res.status(400).json({ success: false, message: 'sessionId required' });
    }

    const s = sessions.get(sessionId);
    if (!s) {
      return res.status(404).json({ success: false, message: 'No deckbuild session found. Call /start first.' });
    }
    if (s.userId !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    // If the session was already finalized (e.g. client retried after a network
    // glitch), return the cached result rather than re-running ML.
    if (s.complete && s.result) {
      return res.status(200).json({
        success: true,
        step: s.step,
        totalSteps: s.step,
        complete: true,
        mainboard: s.result.mainboard,
        sideboard: s.result.sideboard,
      });
    }

    // Refresh TTL while the client is actively stepping.
    s.createdAt = Date.now();

    const candidates = s.remainingPool.filter((oracle) => {
      if (oracleIsConspiracyOrVanguard(oracle)) return false;
      const land = oracleIsLand(oracle);
      if (land && s.landCount >= s.maxLands) return false;
      if (!land && s.spellCount >= s.maxSpells) return false;
      return true;
    });

    // No legal candidate — stop and finalize. Either every remaining card hits
    // a category cap or the pool is exhausted.
    if (candidates.length === 0 || s.mainboard.length >= s.deckSize) {
      s.complete = true;
      s.result = await finalize(s);
      return res.status(200).json({
        success: true,
        step: s.step,
        totalSteps: s.step,
        complete: true,
        mainboard: s.result.mainboard,
        sideboard: s.result.sideboard,
      });
    }

    const uniqueMlCandidates = [...new Set(candidates.map((o) => s.toMl[o] ?? o))];
    const mlMainboard = s.mainboard.map((o) => s.toMl[o] ?? o);

    // Single ML call for this step. Errors propagate so the client can show
    // a real failure instead of a silently-truncated deck.
    const draftResult = await draftOrThrow(uniqueMlCandidates, mlMainboard);

    let bestOracle: string | null = null;
    let bestScore = -Infinity;
    for (const item of draftResult) {
      const originals = s.fromMl[item.oracle] ?? [item.oracle];
      const oracle = originals.find((o) => candidates.includes(o));
      if (!oracle) continue;
      const existing = s.deckCopies[oracle] ?? 0;
      const adjustedRating = item.rating * Math.pow(0.9, existing);
      if (adjustedRating > bestScore) {
        bestScore = adjustedRating;
        bestOracle = oracle;
      }
    }

    s.step += 1;

    if (!bestOracle || bestScore <= 0) {
      // Model didn't recommend any of the remaining candidates — finalize.
      s.complete = true;
      s.result = await finalize(s);
      return res.status(200).json({
        success: true,
        step: s.step,
        totalSteps: s.step,
        complete: true,
        mainboard: s.result.mainboard,
        sideboard: s.result.sideboard,
      });
    }

    const poolIdx = s.remainingPool.indexOf(bestOracle);
    if (poolIdx !== -1) {
      s.mainboard.push(bestOracle);
      s.deckCopies[bestOracle] = (s.deckCopies[bestOracle] ?? 0) + 1;
      s.remainingPool.splice(poolIdx, 1);
      const land = oracleIsLand(bestOracle);
      if (land) s.landCount += 1;
      else s.spellCount += 1;
    }

    // Determine if there's any productive work left.
    const stillActive =
      s.mainboard.length < s.deckSize &&
      s.remainingPool.some((oracle) => {
        if (oracleIsConspiracyOrVanguard(oracle)) return false;
        const land = oracleIsLand(oracle);
        if (land && s.landCount >= s.maxLands) return false;
        if (!land && s.spellCount >= s.maxSpells) return false;
        return true;
      });

    if (!stillActive) {
      s.complete = true;
      s.result = await finalize(s);
      return res.status(200).json({
        success: true,
        step: s.step,
        totalSteps: s.step,
        complete: true,
        mainboard: s.result.mainboard,
        sideboard: s.result.sideboard,
      });
    }

    return res.status(200).json({
      success: true,
      step: s.step,
      totalSteps: s.totalSteps,
      complete: false,
    });
  } catch (err) {
    req.logger.error('Error in deckbuild step', err instanceof Error ? err.stack : String(err));
    if (res.headersSent) return;
    return res.status(500).json({ success: false, message: 'Error in deckbuild step' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '',
    handler: [deckbuildHandler],
  },
  {
    method: 'post',
    path: '/start',
    handler: [startHandler],
  },
  {
    method: 'post',
    path: '/step',
    handler: [stepHandler],
  },
];
