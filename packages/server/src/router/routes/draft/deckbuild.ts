import { isVoucher } from '@utils/cardutil';
import { cubeDao, draftDao } from 'dynamo/daos';
import carddb, { cardFromId, getOracleForMl, getReasonableCardByOracle } from 'serverutils/carddb';
import { calculateBasics } from 'serverutils/draftbots';
import { batchBuild, batchDraft } from 'serverutils/ml';

import { Request, Response } from '../../../types/express';

// ---------------------------------------------------------------------------
// In-memory deckbuild session store
// ---------------------------------------------------------------------------

interface SeatState {
  seatIndex: number;
  maxSpells: number;
  maxLands: number;
  deckSize: number;
  mainboard: string[]; // oracle IDs
  remainingPool: string[]; // oracle IDs
  deckCopies: Record<string, number>;
  spellCount: number;
  landCount: number;
}

interface DeckbuildSession {
  draftId: string;
  userId: string;
  basicsCards: any[]; // CardDetails for the cube basics
  seats: SeatState[];
  seatMaps: {
    toMl: Record<string, string>;
    fromMl: Record<string, string[]>;
  }[];
  step: number;
  totalSteps: number;
  complete: boolean;
  botDecks: { seatIndex: number; mainboard: string[]; sideboard: string[] }[] | null;
  createdAt: number;
}

const sessions = new Map<string, DeckbuildSession>();

// Cleanup sessions older than 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions.entries()) {
    if (now - session.createdAt > 5 * 60 * 1000) {
      sessions.delete(key);
    }
  }
}, 60 * 1000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const oracleIsLand = (oracle: string): boolean => {
  const oracleIds = carddb.oracleToId[oracle];
  return !!(oracleIds && oracleIds[0] && cardFromId(oracleIds[0]).type.includes('Land'));
};

const finalizeBotDecks = (
  seats: SeatState[],
  basicsCards: any[],
): { seatIndex: number; mainboard: string[]; sideboard: string[] }[] => {
  return seats.map((seat) => {
    // Add basics to fill remaining slots
    const mainboardCards = seat.mainboard.map(getReasonableCardByOracle);
    const basicsToAdd = calculateBasics(mainboardCards, basicsCards, seat.deckSize);
    const mainboardOracles = [
      ...seat.mainboard.filter(Boolean),
      ...basicsToAdd.map((card: any) => card.oracle_id).filter(Boolean),
    ];

    return {
      seatIndex: seat.seatIndex,
      mainboard: mainboardOracles.sort(),
      sideboard: seat.remainingPool.filter(Boolean).slice().sort(),
    };
  });
};

// ---------------------------------------------------------------------------
// POST /draft/deckbuild/start/:id
// Initializes a deckbuild session and runs Phase 1 (batchBuild).
// Returns { success, step, totalSteps, complete, botDecks? }
// ---------------------------------------------------------------------------

export const startHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const draftId = req.params.id;
    if (!draftId) {
      return res.status(400).json({ success: false, message: 'Draft ID required' });
    }

    // Clean up any stale session for this draft
    sessions.delete(draftId);

    const draft = await draftDao.getById(draftId);
    if (!draft) {
      return res.status(404).json({ success: false, message: 'Draft not found' });
    }

    const draftOwnerId = typeof draft.owner !== 'string' ? draft.owner?.id : draft.owner;
    if (draftOwnerId !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const { state } = req.body;
    if (!state?.seats) {
      return res.status(400).json({ success: false, message: 'State with seats is required' });
    }

    const cube = await cubeDao.getById(draft.cube);
    const maxSpells = cube?.deckbuildSpells ?? 23;
    const maxLands = cube?.deckbuildLands ?? 17;
    const deckSize = maxSpells + maxLands;

    // Helper to expand voucher picks (same as finish.ts)
    const expandPicks = (picks: number[]): number[] => {
      const expanded: number[] = [];
      for (const pickIndex of picks) {
        const card = draft.cards[pickIndex];
        if (card && isVoucher(card) && card.voucher_card_indices && card.voucher_card_indices.length > 0) {
          expanded.push(...card.voucher_card_indices);
        } else {
          expanded.push(pickIndex);
        }
      }
      return expanded;
    };

    const basicsCards = draft.basics.map((index: number) => draft.cards[index]?.details).filter(Boolean);

    // Collect bot seats (seat 0 is always the human player)
    const botSeats: { seatIndex: number; expandedPicks: number[] }[] = [];
    for (let i = 1; i < draft.seats.length; i++) {
      const stateSeat = state.seats[i];
      if (!stateSeat) continue;
      botSeats.push({ seatIndex: i, expandedPicks: expandPicks(stateSeat.picks) });
    }

    if (botSeats.length === 0) {
      return res.status(200).json({ success: true, step: 1, totalSteps: 1, complete: true, botDecks: [] });
    }

    // Build oracle pools and ML substitution maps per seat
    const allPoolOracles: string[][] = botSeats.map((bot) =>
      bot.expandedPicks
        .map((index) => draft.cards[index]?.details?.oracle_id)
        .filter((id): id is string => Boolean(id)),
    );

    const seatMaps = allPoolOracles.map((poolOracles) => {
      const toMl: Record<string, string> = {};
      const fromMl: Record<string, string[]> = {};
      for (const oracle of poolOracles) {
        if (toMl[oracle] !== undefined) continue;
        const mlOracle = getOracleForMl(oracle, null);
        toMl[oracle] = mlOracle;
        if (!fromMl[mlOracle]) fromMl[mlOracle] = [];
        if (!fromMl[mlOracle]!.includes(oracle)) fromMl[mlOracle]!.push(oracle);
      }
      return { toMl, fromMl };
    });

    const allPoolMlOracles = allPoolOracles.map((poolOracles, idx) => {
      const { toMl } = seatMaps[idx]!;
      return poolOracles.map((o) => toMl[o] ?? o);
    });

    // Phase 1: single batched batchBuild call across all seats
    const allBuildResults = await batchBuild(allPoolMlOracles);

    // Initialize per-seat state
    const seats: SeatState[] = botSeats.map((bot, idx) => {
      const poolOracles = allPoolOracles[idx] || [];
      return {
        seatIndex: bot.seatIndex,
        maxSpells,
        maxLands,
        deckSize,
        mainboard: [] as string[],
        remainingPool: [...poolOracles],
        deckCopies: {} as Record<string, number>,
        spellCount: 0,
        landCount: 0,
      };
    });

    // Seed up to 10 cards per seat from build results
    for (let s = 0; s < seats.length; s++) {
      const seat = seats[s]!;
      const { fromMl } = seatMaps[s]!;
      const buildResult = allBuildResults[s] || [];

      for (const item of buildResult) {
        if (seat.mainboard.length >= 10) break;

        const mlOracle = item.oracle;
        const originals = fromMl[mlOracle] ?? [mlOracle];
        const oracle = originals.find((o) => seat.remainingPool.includes(o));
        if (!oracle) continue;

        const land = oracleIsLand(oracle);
        if (land && seat.landCount >= seat.maxLands) continue;
        if (!land && seat.spellCount >= seat.maxSpells) continue;

        const poolIdx = seat.remainingPool.indexOf(oracle);
        if (poolIdx === -1) continue;

        const existing = seat.deckCopies[oracle] ?? 0;
        const adjustedRating = item.rating * Math.pow(0.9, existing);
        if (adjustedRating <= 0) continue;

        seat.mainboard.push(oracle);
        seat.deckCopies[oracle] = existing + 1;
        seat.remainingPool.splice(poolIdx, 1);

        if (land) seat.landCount += 1;
        else seat.spellCount += 1;
      }
    }

    const totalSteps = 1 + Math.max(0, deckSize - 10);

    // Check if already complete (unlikely after just Phase 1 but possible with tiny pools)
    const anyActive = seats.some((seat) => seat.mainboard.length < seat.deckSize && seat.remainingPool.length > 0);

    if (!anyActive) {
      const botDecks = finalizeBotDecks(seats, basicsCards);
      return res.status(200).json({ success: true, step: 1, totalSteps: 1, complete: true, botDecks });
    }

    // Store session for subsequent step calls
    sessions.set(draftId, {
      draftId,
      userId: req.user.id,
      basicsCards,
      seats,
      seatMaps,
      step: 1,
      totalSteps,
      complete: false,
      botDecks: null,
      createdAt: Date.now(),
    });

    return res.status(200).json({ success: true, step: 1, totalSteps, complete: false });
  } catch (err) {
    req.logger.error('Error starting deckbuild', err);
    return res.status(500).json({ success: false, message: 'Error starting deckbuild' });
  }
};

// ---------------------------------------------------------------------------
// POST /draft/deckbuild/step/:id
// Runs one Phase 2 iteration (single batchDraft call) and returns progress.
// On completion returns the finalized bot decks.
// ---------------------------------------------------------------------------

export const stepHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const draftId = req.params.id;
    if (!draftId) {
      return res.status(400).json({ success: false, message: 'Draft ID required' });
    }
    const session = sessions.get(draftId);

    if (!session) {
      return res.status(404).json({ success: false, message: 'No deckbuild session found. Call start first.' });
    }

    if (session.userId !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    // If already finalized, return cached results (handles retries after network glitches)
    if (session.complete && session.botDecks) {
      return res.status(200).json({
        success: true,
        step: session.step,
        totalSteps: session.step,
        complete: true,
        botDecks: session.botDecks,
      });
    }

    // Build batch inputs for seats that still need cards
    const activeIndices: number[] = [];
    const batchInputs: { pack: string[]; pool: string[] }[] = [];

    for (let s = 0; s < session.seats.length; s++) {
      const seat = session.seats[s]!;
      const { toMl } = session.seatMaps[s]!;

      if (seat.mainboard.length >= seat.deckSize || seat.remainingPool.length === 0) continue;

      const candidates = seat.remainingPool.filter((oracle) => {
        const land = oracleIsLand(oracle);
        if (land && seat.landCount >= seat.maxLands) return false;
        if (!land && seat.spellCount >= seat.maxSpells) return false;
        return true;
      });

      if (candidates.length === 0) continue;

      activeIndices.push(s);
      batchInputs.push({
        pack: [...new Set(candidates.map((o) => toMl[o] ?? o))],
        pool: seat.mainboard.map((o) => toMl[o] ?? o),
      });
    }

    if (batchInputs.length === 0) {
      // All seats are done
      const botDecks = finalizeBotDecks(session.seats, session.basicsCards);
      session.complete = true;
      session.botDecks = botDecks;
      return res.status(200).json({
        success: true,
        step: session.step,
        totalSteps: session.step,
        complete: true,
        botDecks,
      });
    }

    // Single ML call for this step
    const batchResults = await batchDraft(batchInputs);

    let anyProgress = false;
    for (let i = 0; i < activeIndices.length; i++) {
      const s = activeIndices[i]!;
      const seat = session.seats[s]!;
      const { fromMl } = session.seatMaps[s]!;
      const draftResult = batchResults[i] || [];

      let bestOracle: string | null = null;
      let bestScore = -Infinity;

      for (const item of draftResult) {
        const mlOracle = item.oracle;
        const originals = fromMl[mlOracle] ?? [mlOracle];
        const oracle = originals.find((o) => seat.remainingPool.includes(o));
        if (!oracle) continue;

        const existing = seat.deckCopies[oracle] ?? 0;
        const adjustedRating = item.rating * Math.pow(0.9, existing);
        if (adjustedRating > bestScore) {
          bestScore = adjustedRating;
          bestOracle = oracle;
        }
      }

      if (!bestOracle || bestScore <= 0) continue;

      const poolIdx = seat.remainingPool.indexOf(bestOracle);
      if (poolIdx === -1) continue;

      seat.mainboard.push(bestOracle);
      seat.deckCopies[bestOracle] = (seat.deckCopies[bestOracle] ?? 0) + 1;
      seat.remainingPool.splice(poolIdx, 1);

      const land = oracleIsLand(bestOracle);
      if (land) seat.landCount += 1;
      else seat.spellCount += 1;

      anyProgress = true;
    }

    session.step += 1;

    // Check if we're done
    let stillActive = false;
    if (anyProgress) {
      stillActive = session.seats.some((seat) => {
        if (seat.mainboard.length >= seat.deckSize || seat.remainingPool.length === 0) return false;
        return seat.remainingPool.some((oracle) => {
          const land = oracleIsLand(oracle);
          if (land && seat.landCount >= seat.maxLands) return false;
          if (!land && seat.spellCount >= seat.maxSpells) return false;
          return true;
        });
      });
    }

    if (!stillActive) {
      const botDecks = finalizeBotDecks(session.seats, session.basicsCards);
      session.complete = true;
      session.botDecks = botDecks;
      return res.status(200).json({
        success: true,
        step: session.step,
        totalSteps: session.step,
        complete: true,
        botDecks,
      });
    }

    return res.status(200).json({
      success: true,
      step: session.step,
      totalSteps: session.totalSteps,
      complete: false,
    });
  } catch (err) {
    req.logger.error('Error in deckbuild step', err);
    return res.status(500).json({ success: false, message: 'Error in deckbuild step' });
  }
};

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export const routes = [
  {
    path: '/start/:id',
    method: 'post',
    handler: [startHandler],
  },
  {
    path: '/step/:id',
    method: 'post',
    handler: [stepHandler],
  },
];
