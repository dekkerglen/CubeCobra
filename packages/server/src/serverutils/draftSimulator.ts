import Card from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import {
  ArchetypeEntry,
  CardStats,
  ColorBalance,
  HealthReport,
  P1P1Entry,
  SimulationProgress,
} from '@utils/datatypes/HealthReport';
import { createDraft, getDraftFormat } from '@utils/drafting/createdraft';

import { draft as mlDraft } from './ml';

export interface SimulationConfig {
  numDrafts: number;
  numSeats: number;
  deadCardThreshold: number; // 0.0 - 1.0
}

export type ProgressCallback = (progress: SimulationProgress) => void;

// Mutable accumulator updated as drafts complete
interface RawCardStats {
  name: string;
  colorIdentity: string[];
  timesSeen: number;
  timesPicked: number;
  pickPositionSum: number;
  pickPositionCount: number;
  wheelCount: number;
  p1p1Count: number;
}

// Determine the primary color pair for a seat's drafted pool
function assessPoolColors(pool: number[], cards: Card[]): string {
  const colorCounts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  let nonlandCount = 0;

  for (const idx of pool) {
    const card = cards[idx];
    if (!card?.details) continue;
    if (card.details.type?.includes('Land')) continue;
    nonlandCount++;
    for (const color of card.details.color_identity || []) {
      if (color in colorCounts) colorCounts[color] = (colorCounts[color] ?? 0) + 1;
    }
  }

  if (nonlandCount === 0) return 'C';

  const threshold = 0.25;
  const colors = Object.keys(colorCounts)
    .filter((c) => (colorCounts[c] ?? 0) / nonlandCount > threshold)
    .sort();

  return colors.length === 0 ? 'C' : colors.join('');
}

// Simulate a single draft and accumulate stats into statsMap and archetypeCounts
async function simulateOneDraft(
  cube: Cube,
  boardCards: Record<string, Card[]>,
  numSeats: number,
  draftNum: number,
  statsMap: Map<string, RawCardStats>,
  archetypeCounts: Map<string, number>,
): Promise<void> {
  const formatId = cube.defaultFormat === undefined ? -1 : cube.defaultFormat;
  const format = getDraftFormat({ id: formatId, packs: 3, players: numSeats, cards: 15 }, cube);

  let draft: Draft;
  try {
    draft = createDraft(cube, format, boardCards, numSeats, undefined, `healthreport-${draftNum}-${Date.now()}`);
  } catch {
    // If pack creation fails (e.g. not enough cards for this seat count), skip this draft
    return;
  }

  const { InitialState, cards } = draft;
  if (!InitialState || InitialState.length === 0) return;

  const numPacks = InitialState[0]?.length ?? 0;
  if (numPacks === 0) return;

  // currentPacks[seat] = remaining card indices in that seat's current pack
  const currentPacks: number[][] = Array.from({ length: numSeats }, (_, s) =>
    [...(InitialState[s]?.[0]?.cards ?? [])],
  ) as number[][];
  // pools[seat] = oracle_ids of cards picked so far by this seat
  const pools: string[][] = Array.from({ length: numSeats }, () => []) as string[][];
  // pickorderIndices[seat] = card indices in pick order (for archetype calculation)
  const pickorderIndices: number[][] = Array.from({ length: numSeats }, () => []) as number[][];

  // Typed seat accessors (s is always in 0..numSeats-1)
  const seatPack = (s: number): number[] => currentPacks[s] as number[];
  const seatPool = (s: number): string[] => pools[s] as string[];
  const seatPickorder = (s: number): number[] => pickorderIndices[s] as number[];

  // Helper: resolve oracle_id for a card index (returns undefined for custom cards without oracle)
  const getOracle = (idx: number): string | undefined => {
    const card = cards[idx];
    return card?.details?.oracle_id;
  };

  // Helper: get or init a card's stats entry
  const getStats = (oracleId: string, idx: number): RawCardStats => {
    let entry = statsMap.get(oracleId);
    if (!entry) {
      const card = cards[idx];
      entry = {
        name: card?.details?.name ?? card?.details?.oracle_id ?? oracleId,
        colorIdentity: card?.details?.color_identity ?? [],
        timesSeen: 0,
        timesPicked: 0,
        pickPositionSum: 0,
        pickPositionCount: 0,
        wheelCount: 0,
        p1p1Count: 0,
      };
      statsMap.set(oracleId, entry);
    }
    return entry;
  };

  for (let packNum = 0; packNum < numPacks; packNum++) {
    // Open packs for this round (skip pack 0 which is already loaded)
    if (packNum > 0) {
      for (let s = 0; s < numSeats; s++) {
        currentPacks[s] = [...(InitialState[s]?.[packNum]?.cards ?? [])];
      }
    }

    const steps = InitialState[0]?.[packNum]?.steps ?? [];
    let pickNumInPack = 1; // 1-based pick position within this pack

    for (const step of steps) {
      if (step.action === 'pick' || step.action === 'pickrandom') {
        const numPicksThisStep = step.amount ?? 1;

        for (let p = 0; p < numPicksThisStep; p++) {
          // Record timesSeen for every card in every seat's current pack
          for (let s = 0; s < numSeats; s++) {
            for (const idx of seatPack(s)) {
              const oracle = getOracle(idx);
              if (oracle) getStats(oracle, idx).timesSeen++;
            }
          }

          // Build ML requests for all seats in parallel
          const pickRequests = Array.from({ length: numSeats }, (_, s) => {
            const packIndices = seatPack(s);
            const packOracles = packIndices.map(getOracle).filter((o): o is string => o !== undefined);
            const poolOracles = seatPool(s);
            return { packOracles, poolOracles, packIndices };
          });

          // Fire all ML calls in parallel
          const mlResults = await Promise.all(
            pickRequests.map(({ packOracles, poolOracles }) =>
              step.action === 'pickrandom' || packOracles.length === 0
                ? Promise.resolve([] as { oracle: string; rating: number }[])
                : mlDraft(packOracles, poolOracles),
            ),
          );

          // Apply picks for each seat
          for (let s = 0; s < numSeats; s++) {
            const req = pickRequests[s]!;
            const { packIndices } = req;
            if (packIndices.length === 0) continue;

            let pickedIdx: number;
            const seatMlResult = mlResults[s] ?? [];

            if (step.action === 'pickrandom' || seatMlResult.length === 0) {
              // Random fallback: pick first card (deterministic for reproducibility)
              pickedIdx = packIndices[0]!;
            } else {
              // Find the highest-rated card that's actually in this pack
              const packOracleSet = new Set(req.packOracles);
              const topPick = seatMlResult.find((r) => packOracleSet.has(r.oracle));
              const pickedOracle = topPick?.oracle ?? req.packOracles[0];

              // Map oracle back to card index (first match handles multiples edge case)
              pickedIdx =
                packIndices.find((idx) => getOracle(idx) === pickedOracle) ?? packIndices[0]!;
            }

            const pickedOracle = getOracle(pickedIdx);

            // Update pack: remove picked card
            currentPacks[s] = seatPack(s).filter((idx) => idx !== pickedIdx);
            // Update pool
            if (pickedOracle) seatPool(s).push(pickedOracle);
            // Track pick order for archetype
            seatPickorder(s).push(pickedIdx);

            // Update stats
            if (pickedOracle) {
              const entry = getStats(pickedOracle, pickedIdx);
              entry.timesPicked++;
              entry.pickPositionSum += pickNumInPack;
              entry.pickPositionCount++;

              if (pickNumInPack > numSeats) entry.wheelCount++;
              if (packNum === 0 && pickNumInPack === 1) entry.p1p1Count++;
            }
          }

          pickNumInPack++;
        }
      } else if (step.action === 'trash' || step.action === 'trashrandom') {
        const numTrashThisStep = step.amount ?? 1;

        for (let p = 0; p < numTrashThisStep; p++) {
          // Record timesSeen for trashed cards too
          for (let s = 0; s < numSeats; s++) {
            for (const idx of seatPack(s)) {
              const oracle = getOracle(idx);
              if (oracle) getStats(oracle, idx).timesSeen++;
            }
          }

          // All seats trash simultaneously (random selection — trashed cards don't affect pool)
          for (let s = 0; s < numSeats; s++) {
            if (seatPack(s).length === 0) continue;
            currentPacks[s] = seatPack(s).slice(1);
          }

          pickNumInPack++;
        }
      } else if (step.action === 'pass') {
        // Direction: even packs (0-indexed) pass left (+1), odd packs pass right (-1)
        const direction = packNum % 2 === 0 ? 1 : -1;
        const snapshot = currentPacks.map((p) => p.slice());

        for (let s = 0; s < numSeats; s++) {
          const dest = (s + direction + numSeats) % numSeats;
          currentPacks[dest] = snapshot[s]!;
        }
      }
      // endpack: handled by outer loop; skip
    }
  }

  // Determine archetype for each seat
  for (let s = 0; s < numSeats; s++) {
    const archetype = assessPoolColors(seatPickorder(s), cards);
    archetypeCounts.set(archetype, (archetypeCounts.get(archetype) ?? 0) + 1);
  }
}

export async function runSimulation(
  cube: Cube,
  boardCards: Record<string, Card[]>,
  config: SimulationConfig,
  onProgress: ProgressCallback,
): Promise<HealthReport> {
  const { numDrafts, numSeats } = config;

  const statsMap = new Map<string, RawCardStats>();
  const archetypeCounts = new Map<string, number>();

  onProgress({ currentDraft: 0, totalDrafts: numDrafts, percentage: 0 });

  for (let i = 0; i < numDrafts; i++) {
    await simulateOneDraft(cube, boardCards, numSeats, i, statsMap, archetypeCounts);

    const percentage = Math.round(((i + 1) / numDrafts) * 100);
    onProgress({ currentDraft: i + 1, totalDrafts: numDrafts, percentage });
  }

  return computeReport(statsMap, archetypeCounts, config, cube);
}

function computeReport(
  statsMap: Map<string, RawCardStats>,
  archetypeCounts: Map<string, number>,
  config: SimulationConfig,
  cube: Cube,
): HealthReport {
  const { numDrafts, numSeats, deadCardThreshold } = config;

  const cardStats: CardStats[] = [];

  for (const [oracleId, raw] of statsMap.entries()) {
    const pickRate = raw.timesSeen > 0 ? raw.timesPicked / raw.timesSeen : 0;
    const avgPickPosition =
      raw.pickPositionCount > 0 ? raw.pickPositionSum / raw.pickPositionCount : 0;

    cardStats.push({
      oracle_id: oracleId,
      name: raw.name,
      colorIdentity: raw.colorIdentity,
      timesSeen: raw.timesSeen,
      timesPicked: raw.timesPicked,
      pickRate,
      avgPickPosition,
      wheelCount: raw.wheelCount,
      p1p1Count: raw.p1p1Count,
    });
  }

  // Sort by avgPickPosition ascending (best cards first)
  cardStats.sort((a, b) => a.avgPickPosition - b.avgPickPosition);

  // Dead cards: pickRate below threshold
  const deadCards = cardStats.filter((c) => c.pickRate < deadCardThreshold);

  // Color balance: sum timesPicked weighted by color identity
  const colorBalance: ColorBalance = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  for (const card of cardStats) {
    if (card.colorIdentity.length === 0) {
      colorBalance.C += card.timesPicked;
    } else {
      for (const color of card.colorIdentity) {
        if (color in colorBalance) {
          colorBalance[color] = (colorBalance[color] ?? 0) + card.timesPicked;
        }
      }
    }
  }

  // Convergence score: stdev of pickRates (lower = more converged/solved)
  const rates = cardStats.map((c) => c.pickRate);
  const mean = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  const variance =
    rates.length > 0 ? rates.reduce((sum, r) => sum + (r - mean) ** 2, 0) / rates.length : 0;
  const convergenceScore = Math.sqrt(variance);

  // Archetype distribution
  const totalSeats = numDrafts * numSeats;
  const archetypeDistribution: ArchetypeEntry[] = [...archetypeCounts.entries()]
    .map(([colorPair, count]) => ({
      colorPair,
      count,
      percentage: count / totalSeats,
    }))
    .sort((a, b) => b.count - a.count);

  // P1P1 frequency: top 20 most common P1P1 picks
  const p1p1Frequency: P1P1Entry[] = cardStats
    .filter((c) => c.p1p1Count > 0)
    .sort((a, b) => b.p1p1Count - a.p1p1Count)
    .slice(0, 20)
    .map((c) => ({
      oracle_id: c.oracle_id,
      name: c.name,
      count: c.p1p1Count,
      percentage: c.p1p1Count / totalSeats,
    }));

  return {
    cubeId: cube.id,
    cubeName: cube.name,
    numDrafts,
    numSeats,
    deadCardThreshold,
    cardStats,
    deadCards,
    colorBalance,
    archetypeDistribution,
    p1p1Frequency,
    convergenceScore,
    generatedAt: new Date().toISOString(),
  };
}
