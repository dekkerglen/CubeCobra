import type {
  CardStats,
  SimulationRunData,
  SimulationSetupResponse,
} from '@utils/datatypes/SimulationReport';

interface RawStats {
  name: string;
  colorIdentity: string[];
  elo: number;
  timesSeen: number;
  timesPicked: number;
  pickPositionSum: number;
  pickPositionCount: number;
  wheelCount: number;
  p1p1Count: number;
  p1p1Seen: number;
  poolIndices: number[];
}

export function computeFilteredCardStats(
  setup: Pick<SimulationSetupResponse, 'initialPacks' | 'packSteps' | 'numSeats'>,
  runData: SimulationRunData,
  activePoolIndexSet: Set<number>,
): CardStats[] {
  const { initialPacks, packSteps, numSeats } = setup;
  const statsMap = new Map<string, RawStats>();
  const orderedPicksByPool = runData.slimPools.map((pool) =>
    [...pool.picks].sort((a, b) => a.packNumber - b.packNumber || a.pickNumber - b.pickNumber),
  );
  const pickPointers = new Array<number>(runData.slimPools.length).fill(0);
  const randomTrashPointers = new Array<number>(runData.slimPools.length).fill(0);

  const getStats = (oracleId: string): RawStats => {
    let stats = statsMap.get(oracleId);
    if (!stats) {
      const meta = runData.cardMeta[oracleId];
      stats = {
        name: meta?.name ?? oracleId,
        colorIdentity: meta?.colorIdentity ?? [],
        elo: meta?.elo ?? 1200,
        timesSeen: 0,
        timesPicked: 0,
        pickPositionSum: 0,
        pickPositionCount: 0,
        wheelCount: 0,
        p1p1Count: 0,
        p1p1Seen: 0,
        poolIndices: [],
      };
      statsMap.set(oracleId, stats);
    }
    return stats;
  };

  const numDrafts = runData.numDrafts;
  const numPacks = packSteps.length;
  const allCurrentPacks: string[][][] = Array.from({ length: numDrafts }, (_, draftIndex) =>
    Array.from({ length: numSeats }, (_, seatIndex) => [...(initialPacks[draftIndex]?.[seatIndex]?.[0] ?? [])]),
  );

  for (let packNum = 0; packNum < numPacks; packNum++) {
    if (packNum > 0) {
      for (let draftIndex = 0; draftIndex < numDrafts; draftIndex++) {
        for (let seatIndex = 0; seatIndex < numSeats; seatIndex++) {
          allCurrentPacks[draftIndex]![seatIndex] = [...(initialPacks[draftIndex]?.[seatIndex]?.[packNum] ?? [])];
        }
      }
    }

    const steps = packSteps[packNum] ?? [];
    let pickNumInPack = 1;

    for (const step of steps) {
      if (step.action === 'pick' || step.action === 'pickrandom') {
        const numPicks = step.amount ?? 1;
        for (let p = 0; p < numPicks; p++) {
          for (let draftIndex = 0; draftIndex < numDrafts; draftIndex++) {
            for (let seatIndex = 0; seatIndex < numSeats; seatIndex++) {
              const poolIndex = draftIndex * numSeats + seatIndex;
              const pack = allCurrentPacks[draftIndex]![seatIndex]!;
              const isActivePool = activePoolIndexSet.has(poolIndex);

              if (isActivePool) {
                for (const oracleId of pack) {
                  getStats(oracleId).timesSeen++;
                  if (packNum === 0 && pickNumInPack === 1) getStats(oracleId).p1p1Seen++;
                }
              }

              const poolPicks = orderedPicksByPool[poolIndex] ?? [];
              const nextPick = poolPicks[pickPointers[poolIndex] ?? 0];
              if (!nextPick) continue;
              pickPointers[poolIndex] = (pickPointers[poolIndex] ?? 0) + 1;

              const removeIdx = pack.indexOf(nextPick.oracle_id);
              if (removeIdx >= 0) pack.splice(removeIdx, 1);

              if (isActivePool) {
                const entry = getStats(nextPick.oracle_id);
                entry.timesPicked++;
                entry.pickPositionSum += pickNumInPack;
                entry.pickPositionCount++;
                if (pickNumInPack > numSeats) entry.wheelCount++;
                if (packNum === 0 && pickNumInPack === 1) entry.p1p1Count++;
                entry.poolIndices.push(poolIndex);
              }
            }
          }
          pickNumInPack++;
        }
      } else if (step.action === 'trash' || step.action === 'trashrandom') {
        const numTrash = step.amount ?? 1;
        for (let p = 0; p < numTrash; p++) {
          for (let draftIndex = 0; draftIndex < numDrafts; draftIndex++) {
            for (let seatIndex = 0; seatIndex < numSeats; seatIndex++) {
              const poolIndex = draftIndex * numSeats + seatIndex;
              const pack = allCurrentPacks[draftIndex]![seatIndex]!;
              if (activePoolIndexSet.has(poolIndex)) {
                for (const oracleId of pack) getStats(oracleId).timesSeen++;
              }
              if (pack.length === 0) continue;
              if (step.action === 'trashrandom') {
                const trashed = runData.randomTrashByPool?.[poolIndex]?.[randomTrashPointers[poolIndex] ?? 0];
                randomTrashPointers[poolIndex] = (randomTrashPointers[poolIndex] ?? 0) + 1;
                if (!trashed) {
                  // randomTrashByPool metadata absent (older run format) — discard partial accumulation
                  // and fall back to the pre-computed approximate stats stored on the run.
                  return runData.cardStats.filter((cardStats) =>
                    cardStats.poolIndices.some((poolIdx) => activePoolIndexSet.has(poolIdx)),
                  );
                }
                const removeIdx = pack.indexOf(trashed);
                if (removeIdx >= 0) pack.splice(removeIdx, 1);
              } else {
                pack.shift();
              }
            }
          }
          pickNumInPack++;
        }
      } else if (step.action === 'pass') {
        const direction = packNum % 2 === 0 ? 1 : -1;
        for (let draftIndex = 0; draftIndex < numDrafts; draftIndex++) {
          const snapshot = allCurrentPacks[draftIndex]!.map((pack) => [...pack]);
          for (let seatIndex = 0; seatIndex < numSeats; seatIndex++) {
            allCurrentPacks[draftIndex]![(seatIndex + direction + numSeats) % numSeats] = snapshot[seatIndex]!;
          }
        }
      }
    }
  }

  return runData.cardStats
    .map((base) => {
      const filtered = statsMap.get(base.oracle_id);
      if (!filtered || filtered.timesSeen === 0) return null;
      return {
        oracle_id: base.oracle_id,
        name: base.name,
        colorIdentity: base.colorIdentity,
        elo: base.elo,
        timesSeen: filtered.timesSeen,
        timesPicked: filtered.timesPicked,
        pickRate: filtered.timesSeen > 0 ? filtered.timesPicked / filtered.timesSeen : 0,
        avgPickPosition: filtered.pickPositionCount > 0 ? filtered.pickPositionSum / filtered.pickPositionCount : 0,
        wheelCount: filtered.wheelCount,
        p1p1Count: filtered.p1p1Count,
        p1p1Seen: filtered.p1p1Seen,
        poolIndices: filtered.poolIndices,
      };
    })
    .filter((cardStats): cardStats is CardStats => cardStats !== null);
}
