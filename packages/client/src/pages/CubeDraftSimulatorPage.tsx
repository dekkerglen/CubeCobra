import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import Cube from '@utils/datatypes/Cube';
import {
  ArchetypeEntry,
  ArchetypeSkeleton,
  BuiltDeck,
  CardMeta,
  CardStats,
  ColorBalance,
  LockPair,
  P1P1Entry,
  SimulatedPickCard,
  SimulatedPool,
  SimulationReport,
  SimulationRunData,
  SimulationRunEntry,
  SimulationSetupResponse,
  SkeletonCard,
  SlimPool,
} from '@utils/datatypes/SimulationReport';
import { getCubeId } from '@utils/Util';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  PointElement,
  ScatterController,
  Tooltip,
} from 'chart.js';
import { Bar, Scatter } from 'react-chartjs-2';

import { Card, CardBody, CardHeader } from '../components/base/Card';
import Collapse from '../components/base/Collapse';
import Input from '../components/base/Input';
import { Col, Flexbox, Row } from '../components/base/Layout';
import Text from '../components/base/Text';
import DynamicFlash from '../components/DynamicFlash';
import ConfirmDeleteModal from '../components/modals/ConfirmDeleteModal';
import RenderToRoot from '../components/RenderToRoot';
import { CSRFContext } from '../contexts/CSRFContext';
import { DisplayContextProvider } from '../contexts/DisplayContext';
import CubeLayout from '../layouts/CubeLayout';
import MainLayout from '../layouts/MainLayout';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, ScatterController, Tooltip, Legend);

/** Number input that lets the user type freely; commits/clamps only on blur or Enter. */
const NumericInput: React.FC<{
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  className?: string;
}> = ({ value, min, max, onChange, disabled, className }) => {
  const [draft, setDraft] = useState(String(value));
  // Keep draft in sync when the parent value changes externally
  const prevValueRef = useRef(value);
  useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      setDraft(String(value));
    }
  }, [value]);

  const commit = () => {
    const parsed = parseInt(draft, 10);
    const clamped = isNaN(parsed) ? value : Math.max(min, Math.min(max, parsed));
    prevValueRef.current = clamped;
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  };

  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={draft}
      disabled={disabled}
      className={className}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const nextDraft = e.target.value;
        setDraft(nextDraft);
        const parsed = parseInt(nextDraft, 10);
        if (!isNaN(parsed)) {
          const clamped = Math.max(min, Math.min(max, parsed));
          prevValueRef.current = clamped;
          if (clamped !== value) onChange(clamped);
        }
      }}
      onBlur={commit}
      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
    />
  );
};

const MTG_COLORS: Record<string, { bg: string; label: string }> = {
  W: { bg: '#D8CEAB', label: 'White' },
  U: { bg: '#67A6D3', label: 'Blue' },
  B: { bg: '#8C7A91', label: 'Black' },
  R: { bg: '#D85F69', label: 'Red' },
  G: { bg: '#6AB572', label: 'Green' },
  C: { bg: '#ADADAD', label: 'Colorless' },
  M: { bg: '#DBC467', label: 'Multicolor' },
};

const COLOR_FULL_NAMES: Record<string, string> = {
  W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless',
};

function archetypeFullName(colorPair: string): string {
  if (!colorPair || colorPair === 'C') return 'Colorless';
  const parts = colorPair.split('').filter((c) => c in COLOR_FULL_NAMES).map((c) => COLOR_FULL_NAMES[c]!);
  return parts.length > 0 ? parts.join('/') : colorPair;
}

function getColorProfileCodes(colorPair: string): string[] {
  const letters = colorPair.split('').filter((c) => c in MTG_COLORS && c !== 'C' && c !== 'M');
  return letters.length === 0 ? ['C'] : letters;
}

function getColorProfileGradient(colorPair: string): string {
  const colors = getColorProfileCodes(colorPair).map((code) => MTG_COLORS[code]?.bg ?? MTG_COLORS.C!.bg);
  if (colors.length === 1) return colors[0]!;
  return `linear-gradient(90deg, ${colors.map((color, index) => `${color} ${(index / (colors.length - 1)) * 100}%`).join(', ')})`;
}


interface RawStats {
  name: string; colorIdentity: string[]; elo: number;
  timesSeen: number; timesPicked: number; pickPositionSum: number; pickPositionCount: number;
  wheelCount: number; p1p1Count: number; p1p1Seen: number; poolIndices: number[];
}

const PriorRunDeleteModal: React.FC<{
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  run: SimulationRunEntry | null;
  onConfirm: (ts: number) => Promise<void>;
}> = ({ isOpen, setOpen, run, onConfirm }) => {
  if (!run) return null;

  return (
    <ConfirmDeleteModal
      isOpen={isOpen}
      setOpen={setOpen}
      text={`Delete the saved simulation run from ${new Date(run.generatedAt).toLocaleString()}? This action cannot be undone.`}
      submitDelete={async () => {
        await onConfirm(run.ts);
        setOpen(false);
      }}
    />
  );
};

function randomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}

function assessPoolColors(picks: string[], cardMeta: Record<string, CardMeta>): string {
  const colorCounts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  let count = 0;
  for (const oracle of picks) {
    const meta = cardMeta[oracle];
    if (!meta || meta.colorIdentity.length === 0) continue;
    count++;
    for (const c of meta.colorIdentity) {
      if (c in colorCounts) colorCounts[c] = (colorCounts[c] ?? 0) + 1;
    }
  }
  if (count === 0) return 'C';
  const colors = Object.keys(colorCounts).filter((c) => (colorCounts[c] ?? 0) / count >= 0.25).sort();
  return colors.length === 0 ? 'C' : colors.join('');
}

function assessDeckColors(cards: string[], cardMeta: Record<string, CardMeta>): string {
  const colors = new Set<string>();
  for (const oracle of cards) {
    const meta = cardMeta[oracle];
    if (!meta) continue;
    if ((meta.type ?? '').toLowerCase().includes('land')) continue;
    for (const color of meta.colorIdentity) {
      if (color in COLOR_FULL_NAMES && color !== 'C') colors.add(color);
    }
  }
  return colors.size > 0 ? [...colors].sort().join('') : 'C';
}

function reconstructSimulatedPools(slimPools: SlimPool[], cardMeta: Record<string, CardMeta>): SimulatedPool[] {
  return slimPools.map((slim, poolIndex) => ({
    poolIndex,
    draftIndex: slim.draftIndex,
    seatIndex: slim.seatIndex,
    archetype: slim.archetype,
    picks: slim.picks.map((p) => {
      const meta = cardMeta[p.oracle_id];
      return { oracle_id: p.oracle_id, name: meta?.name ?? p.oracle_id, imageUrl: meta?.imageUrl ?? '', packNumber: p.packNumber, pickNumber: p.pickNumber };
    }),
  }));
}

function computeFilteredCardStats(
  setup: SimulationSetupResponse,
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
  const getStats = (oracle: string): RawStats => {
    let s = statsMap.get(oracle);
    if (!s) {
      const meta = runData.cardMeta[oracle];
      s = {
        name: meta?.name ?? oracle,
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
      statsMap.set(oracle, s);
    }
    return s;
  };

  const numDrafts = runData.numDrafts;
  const numPacks = packSteps.length;
  const allCurrentPacks: string[][][] = Array.from({ length: numDrafts }, (_, d) =>
    Array.from({ length: numSeats }, (_, s) => [...(initialPacks[d]?.[s]?.[0] ?? [])]),
  );

  for (let packNum = 0; packNum < numPacks; packNum++) {
    if (packNum > 0) {
      for (let d = 0; d < numDrafts; d++) {
        for (let s = 0; s < numSeats; s++) {
          allCurrentPacks[d]![s] = [...(initialPacks[d]?.[s]?.[packNum] ?? [])];
        }
      }
    }

    const steps = packSteps[packNum] ?? [];
    let pickNumInPack = 1;

    for (const step of steps) {
      if (step.action === 'pick' || step.action === 'pickrandom') {
        const numPicks = step.amount ?? 1;
        for (let p = 0; p < numPicks; p++) {
          for (let d = 0; d < numDrafts; d++) {
            for (let s = 0; s < numSeats; s++) {
              const poolIndex = d * numSeats + s;
              const pack = allCurrentPacks[d]![s]!;
              const isActivePool = activePoolIndexSet.has(poolIndex);

              if (isActivePool) {
                for (const oracle of pack) {
                  getStats(oracle).timesSeen++;
                  if (packNum === 0 && pickNumInPack === 1) getStats(oracle).p1p1Seen++;
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
          for (let d = 0; d < numDrafts; d++) {
            for (let s = 0; s < numSeats; s++) {
              const poolIndex = d * numSeats + s;
              const pack = allCurrentPacks[d]![s]!;
              if (pack.length === 0) continue;
              if (step.action === 'trashrandom') {
                const trashed = runData.randomTrashByPool?.[poolIndex]?.[randomTrashPointers[poolIndex] ?? 0];
                randomTrashPointers[poolIndex] = (randomTrashPointers[poolIndex] ?? 0) + 1;
                if (!trashed) return runData.cardStats.filter((c) => c.poolIndices.some((i) => activePoolIndexSet.has(i)));
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
        for (let d = 0; d < numDrafts; d++) {
          const snapshot = allCurrentPacks[d]!.map((pack) => [...pack]);
          for (let s = 0; s < numSeats; s++) allCurrentPacks[d]![(s + direction + numSeats) % numSeats] = snapshot[s]!;
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
        poolIndices: filtered.poolIndices,
      };
    })
    .filter((c): c is CardStats => c !== null);
}

async function runClientSimulation(
  setup: SimulationSetupResponse,
  numDrafts: number,
  deadCardThreshold: number,
  onProgress: (pct: number) => void,
): Promise<SimulationReport> {
  const { initialPacks, packSteps, cardMeta, cubeName, numSeats } = setup;
  const statsMap = new Map<string, RawStats>();
  const archetypeCounts = new Map<string, number>();

  const getStats = (oracle: string): RawStats => {
    let s = statsMap.get(oracle);
    if (!s) {
      const meta = cardMeta[oracle];
      s = { name: meta?.name ?? oracle, colorIdentity: meta?.colorIdentity ?? [], elo: meta?.elo ?? 1200, timesSeen: 0, timesPicked: 0, pickPositionSum: 0, pickPositionCount: 0, wheelCount: 0, p1p1Count: 0, p1p1Seen: 0, poolIndices: [] };
      statsMap.set(oracle, s);
    }
    return s;
  };

  // Count total pick rounds for progress reporting
  let totalPicks = 0;
  for (const steps of packSteps) {
    for (const step of steps) {
      if (step.action === 'pick' || step.action === 'pickrandom') totalPicks += step.amount ?? 1;
    }
  }
  let donePicks = 0;

  const numPacks = packSteps.length;
  const allCurrentPacks: string[][][] = Array.from({ length: numDrafts }, (_, d) =>
    Array.from({ length: numSeats }, (_, s) => [...(initialPacks[d]?.[s]?.[0] ?? [])]),
  );
  const allPools: string[][][] = Array.from({ length: numDrafts }, () => Array.from({ length: numSeats }, () => []));
  const allPickMeta: { packNumber: number; pickNumber: number }[][][] = Array.from({ length: numDrafts }, () => Array.from({ length: numSeats }, () => []));
  const randomTrashByPool: string[][] = Array.from({ length: numDrafts * numSeats }, () => []);

  onProgress(0);

  for (let packNum = 0; packNum < numPacks; packNum++) {
    if (packNum > 0) {
      for (let d = 0; d < numDrafts; d++) for (let s = 0; s < numSeats; s++) allCurrentPacks[d]![s] = [...(initialPacks[d]?.[s]?.[packNum] ?? [])];
    }

    const steps = packSteps[packNum] ?? [];
    let pickNumInPack = 1;

    for (const step of steps) {
      if (step.action === 'pick' || step.action === 'pickrandom') {
        const numPicksThisStep = step.amount ?? 1;
        for (let p = 0; p < numPicksThisStep; p++) {
          // Track timesSeen (and p1p1Seen at P1P1) for all cards currently visible
          const isP1P1 = packNum === 0 && pickNumInPack === 1;
          for (let d = 0; d < numDrafts; d++) for (let s = 0; s < numSeats; s++) for (const oracle of allCurrentPacks[d]![s]!) {
            const st = getStats(oracle);
            st.timesSeen++;
            if (isP1P1) st.p1p1Seen++;
          }

          let picks: string[];

          if (step.action === 'pick') {
            // One ML call for this pick round — all numDrafts×numSeats seats batched together
            const flatPacks = allCurrentPacks.flatMap((draftPacks) => draftPacks);
            const flatPools = allPools.flatMap((draftPools) => draftPools);
            const mlRes = await fetch('/cube/api/simulateall', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ packs: flatPacks, pools: flatPools }),
            });
            if (!mlRes.ok) {
              const body = await mlRes.json().catch(() => ({}));
              throw new Error((body as { message?: string }).message ?? `Simulation failed: ${mlRes.status}`);
            }
            picks = ((await mlRes.json()) as { picks: string[] }).picks;
            const expectedPicks = numDrafts * numSeats;
            if (!Array.isArray(picks) || picks.length !== expectedPicks) {
              throw new Error(`ML service returned ${picks?.length ?? 0} picks, expected ${expectedPicks}`);
            }
          } else {
            // pickrandom — choose a random card from each pack, no ML call needed
            picks = allCurrentPacks.flatMap((draftPacks) =>
              draftPacks.map((pack) => (pack.length > 0 ? pack[randomIndex(pack.length)] ?? '' : '')),
            );
          }

          let idx = 0;
          for (let d = 0; d < numDrafts; d++) for (let s = 0; s < numSeats; s++) {
            const oracle = picks[idx++] ?? '';
            const pack = allCurrentPacks[d]![s]!;
            if (pack.length === 0) continue; // empty pack — skip without recording a pick
            const removeIdx = pack.indexOf(oracle);
            if (removeIdx >= 0) pack.splice(removeIdx, 1);
            allPools[d]![s]!.push(oracle);
            allPickMeta[d]![s]!.push({ packNumber: packNum, pickNumber: pickNumInPack });
            if (oracle) {
              const entry = getStats(oracle);
              entry.timesPicked++; entry.pickPositionSum += pickNumInPack; entry.pickPositionCount++;
              if (pickNumInPack > numSeats) entry.wheelCount++;
              if (packNum === 0 && pickNumInPack === 1) entry.p1p1Count++;
            }
          }

          donePicks++;
          onProgress(totalPicks > 0 ? Math.round((donePicks / totalPicks) * 100) : 100);
          pickNumInPack++;
        }
      } else if (step.action === 'trash' || step.action === 'trashrandom') {
        const numTrash = step.amount ?? 1;
        for (let p = 0; p < numTrash; p++) {
          for (let d = 0; d < numDrafts; d++) for (let s = 0; s < numSeats; s++) {
            const pack = allCurrentPacks[d]![s]!;
            for (const oracle of pack) getStats(oracle).timesSeen++;
            if (pack.length === 0) continue;
            if (step.action === 'trashrandom') {
              const removeIdx = randomIndex(pack.length);
              const [trashed] = pack.splice(removeIdx, 1);
              if (trashed) randomTrashByPool[d * numSeats + s]!.push(trashed);
            } else pack.shift();
          }
          pickNumInPack++;
        }
      } else if (step.action === 'pass') {
        const direction = packNum % 2 === 0 ? 1 : -1;
        for (let d = 0; d < numDrafts; d++) {
          const snapshot = allCurrentPacks[d]!.map((pack) => [...pack]);
          for (let s = 0; s < numSeats; s++) allCurrentPacks[d]![(s + direction + numSeats) % numSeats] = snapshot[s]!;
        }
      }
    }
  }

  // Build slimPools and archetypes
  const slimPools: SlimPool[] = [];
  for (let d = 0; d < numDrafts; d++) for (let s = 0; s < numSeats; s++) {
    const picks = allPools[d]![s]!;
    const metas = allPickMeta[d]![s]!;
    const archetype = assessPoolColors(picks, cardMeta);
    archetypeCounts.set(archetype, (archetypeCounts.get(archetype) ?? 0) + 1);
    const poolIndex = slimPools.length;
    slimPools.push({
      draftIndex: d,
      seatIndex: s,
      archetype,
      picks: picks.map((oracle_id, k) => ({ oracle_id, packNumber: metas[k]?.packNumber ?? 0, pickNumber: metas[k]?.pickNumber ?? 1 })),
    });
    for (const oracle of picks) if (oracle) statsMap.get(oracle)?.poolIndices.push(poolIndex);
  }

  const cardStats: CardStats[] = [];
  for (const [oracle_id, raw] of statsMap.entries()) {
    cardStats.push({ oracle_id, name: raw.name, colorIdentity: raw.colorIdentity, elo: raw.elo, timesSeen: raw.timesSeen, timesPicked: raw.timesPicked, pickRate: raw.timesSeen > 0 ? raw.timesPicked / raw.timesSeen : 0, avgPickPosition: raw.pickPositionCount > 0 ? raw.pickPositionSum / raw.pickPositionCount : 0, wheelCount: raw.wheelCount, p1p1Count: raw.p1p1Count, poolIndices: raw.poolIndices });
  }
  cardStats.sort((a, b) => a.avgPickPosition - b.avgPickPosition);

  const colorBalance: ColorBalance = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  for (const c of cardStats) {
    if (c.colorIdentity.length === 0) colorBalance.C += c.timesPicked;
    else for (const color of c.colorIdentity) if (color in colorBalance) colorBalance[color] = (colorBalance[color] ?? 0) + c.timesPicked;
  }

  const rates = cardStats.map((c) => c.pickRate);
  const mean = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  const variance = rates.length > 0 ? rates.reduce((sum, r) => sum + (r - mean) ** 2, 0) / rates.length : 0;
  const totalSeats = numDrafts * numSeats;
  const archetypeDistribution: ArchetypeEntry[] = [...archetypeCounts.entries()].map(([colorPair, count]) => ({ colorPair, count, percentage: count / totalSeats })).sort((a, b) => b.count - a.count);
  const p1p1Frequency: P1P1Entry[] = cardStats.filter((c) => c.p1p1Count > 0).sort((a, b) => b.p1p1Count - a.p1p1Count).slice(0, 20).map((c) => {
    const seen = statsMap.get(c.oracle_id)?.p1p1Seen ?? 0;
    return { oracle_id: c.oracle_id, name: c.name, count: c.p1p1Count, percentage: seen > 0 ? c.p1p1Count / seen : 0 };
  });
  const deadCards = cardStats.filter((c) => c.pickRate < deadCardThreshold);

  const simulatedPools = reconstructSimulatedPools(slimPools, cardMeta);

  return {
    cubeId: '',
    cubeName,
    numDrafts,
    numSeats,
    deadCardThreshold,
    cardStats,
    deadCards,
    colorBalance,
    archetypeDistribution,
    p1p1Frequency,
    convergenceScore: Math.sqrt(variance),
    generatedAt: new Date().toISOString(),
    cardMeta,
    slimPools,
    simulatedPools,
    setupData: { initialPacks, packSteps, numSeats },
    randomTrashByPool,
  };
}

// ---------------------------------------------------------------------------
// Archetype skeleton clustering (k-means on binary card-overlap vectors)
// ---------------------------------------------------------------------------

function euclidSq(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += ((a[i] ?? 0) - (b[i] ?? 0)) ** 2;
  return s;
}

function kMeans(vecs: number[][], k: number): number[] {
  const n = vecs.length;
  if (n === 0) return [];
  k = Math.min(k, n);
  const dim = vecs[0]?.length ?? 0;

  // K-means++ init
  const seedIdxs: number[] = [Math.floor(Math.random() * n)];
  while (seedIdxs.length < k) {
    const dists = vecs.map((v) => Math.min(...seedIdxs.map((si) => euclidSq(v, vecs[si]!))));
    const total = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * total, chosen = n - 1;
    for (let i = 0; i < n; i++) { r -= dists[i]!; if (r <= 0) { chosen = i; break; } }
    seedIdxs.push(chosen);
  }

  let centroids: number[][] = seedIdxs.map((i) => [...vecs[i]!]);
  const assignments = new Array<number>(n).fill(0);

  for (let iter = 0; iter < 25; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < k; c++) { const d = euclidSq(vecs[i]!, centroids[c]!); if (d < bestD) { bestD = d; best = c; } }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    if (!changed) break;

    centroids = Array.from({ length: k }, () => new Array(dim).fill(0));
    const counts = new Array<number>(k).fill(0);
    for (let i = 0; i < n; i++) { const c = assignments[i]!; counts[c]++; for (let j = 0; j < dim; j++) centroids[c]![j]! += vecs[i]![j]!; }
    for (let c = 0; c < k; c++) { const cnt = counts[c]; if (cnt > 0) centroids[c] = centroids[c]!.map((v) => v / cnt); }
  }

  return assignments;
}

function computeSkeletons(slimPools: SlimPool[], cardMeta: Record<string, CardMeta>, k: number, coreThresholdPct: number = 60, deckBuilds?: BuiltDeck[] | null): ArchetypeSkeleton[] {
  const n = slimPools.length;
  if (n === 0) return [];
  k = Math.min(k, n); // can't have more clusters than data points

  // Exclude basic lands — they appear in almost every deck and distort clustering
  const oracleIds = Object.keys(cardMeta).filter((id) => {
    const t = (cardMeta[id]?.type ?? '').toLowerCase();
    return !(t.includes('basic') && t.includes('land'));
  });
  const oracleIndex = new Map(oracleIds.map((id, i) => [id, i]));
  const dim = oracleIds.length;

  // Use mainboard decks when available, fall back to draft picks
  const hasDecks = deckBuilds && deckBuilds.length === n;
  const vecs: Uint8Array[] = slimPools.map((pool, i) => {
    const v = new Uint8Array(dim);
    const cards = hasDecks ? deckBuilds![i]!.mainboard : pool.picks.map((p) => p.oracle_id);
    for (const oracle_id of cards) { const idx = oracleIndex.get(oracle_id); if (idx !== undefined) v[idx] = 1; }
    return v;
  });

  // IDF: cards drafted in most pools get low weight, distinguishing cards get high weight
  const df = new Float32Array(dim);
  for (const v of vecs) for (let j = 0; j < dim; j++) if (v[j]) df[j]++;
  const idf = Float32Array.from({ length: dim }, (_, j) => Math.log((n + 1) / (df[j]! + 1)));

  // TF-IDF vectors, L2-normalised → cosine similarity via Euclidean k-means
  const tfidfVecs: number[][] = vecs.map((v) => {
    const vec = Array.from({ length: dim }, (_, j) => v[j]! * idf[j]!);
    const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
    return norm > 0 ? vec.map((x) => x / norm) : vec;
  });
  const assignments = kMeans(tfidfVecs, k);

  const skeletons: ArchetypeSkeleton[] = [];
  for (let clusterId = 0; clusterId < k; clusterId++) {
    const poolIndices = assignments.map((a, i) => (a === clusterId ? i : -1)).filter((i) => i >= 0);
    const poolCount = poolIndices.length;
    if (poolCount === 0) continue;

    // Centroid card fractions: for each card, what fraction of pools in this cluster drafted it
    const fracs = new Float32Array(dim);
    for (const pi of poolIndices) { const v = vecs[pi]!; for (let j = 0; j < dim; j++) fracs[j] += v[j]!; }
    for (let j = 0; j < dim; j++) fracs[j] /= poolCount;

    const allCards: SkeletonCard[] = oracleIds
      .map((oracle_id, j) => ({ oracle_id, name: cardMeta[oracle_id]?.name ?? oracle_id, imageUrl: cardMeta[oracle_id]?.imageUrl ?? '', fraction: fracs[j]! }))
      .filter((c) => c.fraction >= coreThresholdPct / 2 / 100)
      .sort((a, b) => b.fraction - a.fraction);

    const coreThresholdFrac = coreThresholdPct / 100;
    const coreCards = allCards.filter((c) => c.fraction >= coreThresholdFrac).slice(0, 24);
    const occasionalCards = allCards.filter((c) => c.fraction < coreThresholdFrac).slice(0, 12);

    // Color profile
    const colorWeight: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    let totalWeight = 0;
    for (const { oracle_id, fraction } of coreCards) {
      const colors = cardMeta[oracle_id]?.colorIdentity ?? [];
      if (colors.length === 0) continue;
      totalWeight += fraction;
      for (const c of colors) if (c in colorWeight) colorWeight[c] += fraction;
    }
    const colorProfile = Object.entries(colorWeight).filter(([, v]) => totalWeight > 0 && v / totalWeight > 0.2).sort((a, b) => b[1] - a[1]).map(([key]) => key).join('') || 'C';

    // Lock pairs
    const lockPairs: LockPair[] = [];
    const lockCandidates = allCards.filter((c) => c.fraction >= Math.max(0.25, coreThresholdFrac / 2)).slice(0, 24);
    for (let ai = 0; ai < lockCandidates.length; ai++) {
      for (let bi = ai + 1; bi < lockCandidates.length; bi++) {
        const a = lockCandidates[ai]!, b = lockCandidates[bi]!;
        const aIdx = oracleIndex.get(a.oracle_id)!, bIdx = oracleIndex.get(b.oracle_id)!;
        let both = 0;
        for (const pi of poolIndices) if (vecs[pi]![aIdx] && vecs[pi]![bIdx]) both++;
        const rate = both / poolCount;
        if (rate > 0.60 && rate > a.fraction * b.fraction + 0.05) {
          lockPairs.push({ oracle_id_a: a.oracle_id, oracle_id_b: b.oracle_id, nameA: a.name, nameB: b.name, coOccurrenceRate: rate });
        }
      }
    }
    lockPairs.sort((a, b) => b.coOccurrenceRate - a.coOccurrenceRate);

    skeletons.push({ clusterId, colorProfile, poolCount, poolIndices, coreCards, occasionalCards, lockPairs: lockPairs.slice(0, 5) });
  }

  return skeletons.sort((a, b) => b.poolCount - a.poolCount);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SummaryCard: React.FC<{ label: string; value: string | number; sub?: string; onClick?: () => void; badge?: React.ReactNode }> = ({ label, value, sub, onClick, badge }) => (
  <div className={['flex-1 min-w-[180px]', onClick ? 'cursor-pointer' : ''].join(' ')} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
    <Card className={onClick ? 'hover:bg-bg-active transition-colors h-full' : 'h-full'}>
      <CardBody className="text-center py-5">
        <div className="text-4xl font-bold mb-2">{value}</div>
        <div><Text md semibold>{label}</Text></div>
        {sub && <div className="mt-1"><Text xs className="text-text-secondary">{sub}</Text></div>}
        {badge && <div className="mt-2">{badge}</div>}
      </CardBody>
    </Card>
  </div>
);

const COLOR_KEYS = ['W', 'U', 'B', 'R', 'G'] as const;

function getDeckShareColors(oracle: string, cardMeta: Record<string, CardMeta>): string[] {
  const identity = (cardMeta[oracle]?.colorIdentity ?? []).filter((color) => MTG_COLORS[color]);
  if (identity.length > 0) return identity;

  const lower = oracle.toLowerCase();
  if (lower.includes('plains')) return ['W'];
  if (lower.includes('island')) return ['U'];
  if (lower.includes('swamp')) return ['B'];
  if (lower.includes('mountain')) return ['R'];
  if (lower.includes('forest')) return ['G'];
  return [];
}

const DeckColorShareChart: React.FC<{ deckBuilds: BuiltDeck[] | null; cardMeta: Record<string, CardMeta> }> = ({ deckBuilds, cardMeta }) => {
  if (!deckBuilds || deckBuilds.length === 0) {
    return <Text sm className="text-text-secondary">Unavailable for this run. Sign in to load simulated deck builds.</Text>;
  }

  const shares: Record<string, number> = Object.fromEntries(COLOR_KEYS.map((key) => [key, 0]));
  for (const deck of deckBuilds) {
    for (const oracle of deck.mainboard) {
      const cardColors = getDeckShareColors(oracle, cardMeta);
      if (cardColors.length === 0) continue;
      const share = 1 / cardColors.length;
      for (const color of cardColors) shares[color] = (shares[color] ?? 0) + share;
    }
  }

  const totalShare = Object.values(shares).reduce((sum, value) => sum + value, 0);

  const rows = COLOR_KEYS.map((key) => ({
    key,
    label: MTG_COLORS[key]!.label,
    bg: MTG_COLORS[key]!.bg,
    pct: totalShare > 0 ? (shares[key] ?? 0) / totalShare : 0,
  })).filter((r) => r.pct > 0);

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2">
          <span className="w-16 text-xs text-text-secondary text-right flex-shrink-0">{r.label}</span>
          <div className="flex-1 rounded overflow-hidden h-5" style={{ background: 'var(--color-bg-accent)' }}>
            <div
              className="h-full rounded"
              style={{ width: `${(r.pct * 100).toFixed(1)}%`, background: r.bg }}
            />
          </div>
          <span className="w-10 text-xs text-text-secondary flex-shrink-0">{(r.pct * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
};

const MANA_CURVE_BUCKETS = [
  { key: '0', label: '0' },
  { key: '1', label: '1' },
  { key: '2', label: '2' },
  { key: '3', label: '3' },
  { key: '4', label: '4' },
  { key: '5', label: '5' },
  { key: '6', label: '6' },
  { key: '7+', label: '7+' },
] as const;

const ManaCurveShareChart: React.FC<{ deckBuilds: BuiltDeck[] | null; cardMeta: Record<string, CardMeta> }> = ({ deckBuilds, cardMeta }) => {
  if (!deckBuilds || deckBuilds.length === 0) {
    return <Text sm className="text-text-secondary">Unavailable for this run. Sign in to load simulated deck builds.</Text>;
  }

  const counts: Record<string, number> = Object.fromEntries(MANA_CURVE_BUCKETS.map((bucket) => [bucket.key, 0]));
  let totalCards = 0;

  for (const deck of deckBuilds) {
    for (const oracle of deck.mainboard) {
      const meta = cardMeta[oracle];
      const typeLower = (meta?.type ?? '').toLowerCase();
      if (typeLower.includes('land')) continue;
      const cmc = Math.max(0, Math.floor(meta?.cmc ?? 0));
      const bucketKey = cmc >= 7 ? '7+' : String(cmc);
      counts[bucketKey] = (counts[bucketKey] ?? 0) + 1;
      totalCards++;
    }
  }

  const rows = MANA_CURVE_BUCKETS.map((bucket) => ({
    ...bucket,
    pct: totalCards > 0 ? (counts[bucket.key] ?? 0) / totalCards : 0,
  })).filter((row) => row.pct > 0);

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-2">
          <span className="w-10 text-xs text-text-secondary text-right flex-shrink-0">{row.label}</span>
          <div className="flex-1 rounded overflow-hidden h-5" style={{ background: 'var(--color-bg-accent)' }}>
            <div
              className="h-full rounded"
              style={{ width: `${(row.pct * 100).toFixed(1)}%`, background: 'linear-gradient(90deg, #475569 0%, #64748b 100%)' }}
            />
          </div>
          <span className="w-10 text-xs text-text-secondary flex-shrink-0">{(row.pct * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
};

const EloVsPickRateScatter: React.FC<{ cardStats: CardStats[] }> = ({ cardStats }) => {
  const picked = cardStats.filter((c) => c.timesPicked > 0 && c.avgPickPosition > 0);
  const maxAvgPick = Math.max(...picked.map((c) => c.avgPickPosition), 1);
  const pointData = picked.map((c) => ({ x: Math.round(c.elo), y: Math.round(c.avgPickPosition * 10) / 10, label: c.name }));
  const pointColors = picked.map((c) => {
    const colors = c.colorIdentity.filter((x) => x in MTG_COLORS);
    if (colors.length === 0) return MTG_COLORS.C!.bg;
    if (colors.length === 1) return MTG_COLORS[colors[0]!]!.bg;
    return MTG_COLORS.M!.bg;
  });
  return (
    <Scatter
      data={{ datasets: [{ label: 'Cards', data: pointData, backgroundColor: pointColors, pointRadius: 4, pointHoverRadius: 6 }] }}
      options={{
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const pt = ctx.raw as { x: number; y: number; label: string };
                return `${pt.label}: Elo ${pt.x}, Avg Pick Position ${pt.y}`;
              },
            },
          },
        },
        scales: {
          x: { title: { display: true, text: 'Elo' } },
          y: { reverse: true, beginAtZero: false, suggestedMin: 1, suggestedMax: Math.max(15, Math.ceil(maxAvgPick)), title: { display: true, text: 'Average Pick Position' } },
        },
      }}
    />
  );
};

const ArchetypeChart: React.FC<{
  archetypeDistribution: ArchetypeEntry[];
  selectedArchetype: string | null;
  onSelect: (colorPair: string | null) => void;
}> = ({ archetypeDistribution, selectedArchetype, onSelect }) => {
  const [showAllProfiles, setShowAllProfiles] = useState(false);
  const maxCount = Math.max(...archetypeDistribution.map((e) => e.count), 1);
  const visibleEntries = archetypeDistribution.slice(0, 8);
  const hiddenEntries = archetypeDistribution.slice(8);
  const hiddenHasSelection = hiddenEntries.some((entry) => entry.colorPair === selectedArchetype);
  const showHiddenProfiles = showAllProfiles || hiddenHasSelection;

  const renderEntry = (entry: ArchetypeEntry) => {
    const colorCodes = getColorProfileCodes(entry.colorPair);
    const isSelected = entry.colorPair === selectedArchetype;
    const pct = maxCount > 0 ? (entry.count / maxCount) * 100 : 0;

    return (
      <button
        key={entry.colorPair}
        type="button"
        onClick={() => onSelect(isSelected ? null : entry.colorPair)}
        className={[
          'w-full text-left rounded border transition-all',
          'px-3 py-3',
          isSelected
            ? 'border-link-active ring-1 ring-link-active bg-bg-active'
            : 'border-transparent hover:border-border hover:bg-bg-accent',
        ].join(' ')}
        style={isSelected ? { boxShadow: 'inset 0 0 0 1px rgb(var(--link-active) / 0.08)' } : undefined}
      >
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1 flex-shrink-0">
              {colorCodes.map((code) => (
                <span
                  key={code}
                  className="inline-block rounded-full"
                  style={{
                    width: 14,
                    height: 14,
                    background: MTG_COLORS[code]?.bg ?? MTG_COLORS.C!.bg,
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.55), 0 0 0 1px rgba(15, 23, 42, 0.08)',
                  }}
                />
              ))}
            </div>
            <span className="text-sm font-semibold truncate">{archetypeFullName(entry.colorPair)}</span>
          </div>
          <div className="flex items-baseline gap-2 flex-shrink-0">
            <span className="text-sm font-bold text-text">{entry.count}</span>
            <span className="text-xs font-semibold text-text-secondary">{(entry.percentage * 100).toFixed(1)}%</span>
          </div>
        </div>
        <div
          className="rounded-full overflow-hidden"
          style={{ height: 10, background: 'rgb(var(--bg-accent) / 1)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: getColorProfileGradient(entry.colorPair),
            }}
          />
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {visibleEntries.map(renderEntry)}
      {hiddenEntries.length > 0 && (
        <>
          <Collapse isOpen={showHiddenProfiles} className="flex flex-col gap-2">
            {hiddenEntries.map(renderEntry)}
          </Collapse>
          <button
            type="button"
            onClick={() => setShowAllProfiles((open) => !open)}
            className="self-start px-2 py-1 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active"
          >
            {showHiddenProfiles ? 'Show fewer' : 'Show all color profiles'}
          </button>
        </>
      )}
    </div>
  );
};

type SortKey = keyof CardStats | 'deckInclusion';
type DeckLocationFilter = 'all' | 'deck' | 'sideboard';
const CardStatsTable: React.FC<{ cardStats: CardStats[]; deadCardThreshold: number; onSelectCard: (id: string) => void; selectedCardOracle: string | null; inDeckOracles: Set<string> | null; inSideboardOracles: Set<string> | null; deckInclusionPct: Map<string, number>; visiblePoolCounts: Map<string, number>; onPageChange?: () => void }> = ({ cardStats, deadCardThreshold, onSelectCard, selectedCardOracle, inDeckOracles, inSideboardOracles, deckInclusionPct, visiblePoolCounts, onPageChange }) => {
  const PAGE_SIZE = 25;
  const defaultSortDir = (key: SortKey): 'asc' | 'desc' => (key === 'name' || key === 'avgPickPosition' ? 'asc' : 'desc');
  const [sortKey, setSortKey] = useState<SortKey>('avgPickPosition');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState<DeckLocationFilter>('all');
  const [page, setPage] = useState(1);
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(defaultSortDir(key)); }
  };
  const filtered = cardStats.filter((c) => {
    if (!c.name.toLowerCase().includes(filter.toLowerCase())) return false;
    if (locationFilter === 'deck' && inDeckOracles && !inDeckOracles.has(c.oracle_id)) return false;
    if (locationFilter === 'sideboard' && inSideboardOracles && !inSideboardOracles.has(c.oracle_id)) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    let av: number | string, bv: number | string;
    if (sortKey === 'deckInclusion') { av = deckInclusionPct.get(a.oracle_id) ?? 0; bv = deckInclusionPct.get(b.oracle_id) ?? 0; }
    else if (sortKey === 'avgPickPosition') {
      av = a.avgPickPosition > 0 ? a.avgPickPosition : Number.POSITIVE_INFINITY;
      bv = b.avgPickPosition > 0 ? b.avgPickPosition : Number.POSITIVE_INFINITY;
    } else { av = a[sortKey] as number | string; bv = b[sortKey] as number | string; }
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  useEffect(() => {
    setPage(1);
  }, [filter, locationFilter, sortKey, sortDir, cardStats]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const numericSortCols = new Set<SortKey>(['elo', 'timesSeen', 'timesPicked', 'pickRate', 'avgPickPosition', 'wheelCount', 'p1p1Count', 'deckInclusion']);
  const SH: React.FC<{ label: string; col: SortKey; tooltip?: string }> = ({ label, col, tooltip }) => (
    <th
      className={[
        'px-3 py-2 text-xs font-medium uppercase tracking-wider cursor-pointer select-none hover:bg-bg-active whitespace-nowrap',
        numericSortCols.has(col) ? 'text-right' : 'text-left',
      ].join(' ')}
      title={tooltip}
      onClick={() => handleSort(col)}
    >
      {label}{tooltip ? ' ?' : ''}{sortKey === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );
  return (
    <Flexbox direction="col" gap="2">
      <Flexbox direction="row" gap="3" alignItems="center" className="flex-wrap">
        <div className="relative max-w-xs flex items-center">
          <Input type="text" placeholder="Filter by card name…" value={filter} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)} className="w-full pr-7" />
          {filter && (
            <button type="button" onClick={() => setFilter('')} className="absolute right-2 text-text-secondary hover:text-text text-sm leading-none">✕</button>
          )}
        </div>
        {inDeckOracles && (
          <Flexbox direction="row" gap="1">
            {(['all', 'deck', 'sideboard'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setLocationFilter(v)}
                className={[
                  'px-2 py-0.5 rounded text-xs font-medium border',
                  locationFilter === v ? 'bg-link text-white border-link' : 'bg-bg text-text-secondary border-border hover:bg-bg-active',
                ].join(' ')}
              >
                {v === 'all' ? 'All cards' : v === 'deck' ? 'In deck' : 'In sideboard'}
              </button>
            ))}
          </Flexbox>
        )}
      </Flexbox>
      <div className="overflow-x-auto rounded border border-border bg-bg">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-bg-accent"><tr><SH label="Card" col="name" /><SH label="Elo" col="elo" /><SH label="Seen" col="timesSeen" /><SH label="Picked" col="timesPicked" /><SH label="Pick Rate" col="pickRate" /><SH label="Avg Position" col="avgPickPosition" /><SH label="Wheels" col="wheelCount" tooltip="Times this card was drafted after the pack went all the way around the table (position > seats)" /><SH label="P1P1" col="p1p1Count" tooltip="Times this card was taken as the very first pick of pack 1" /><SH label="Deck %" col="deckInclusion" tooltip="Of decks that drafted this card, how often it made the maindeck vs. sideboard" /><th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider">View</th></tr></thead>
          <tbody className="divide-y divide-border">{pagedRows.map((c) => { const isDead = c.pickRate < deadCardThreshold; const inclPct = deckInclusionPct.get(c.oracle_id); const isFilteredCard = c.oracle_id === selectedCardOracle; const visiblePoolCount = visiblePoolCounts.get(c.oracle_id) ?? c.poolIndices.length; return (<tr key={c.oracle_id} className={[isFilteredCard ? 'bg-bg-active' : '', isDead ? 'bg-red-950/20' : 'hover:bg-bg-active'].filter(Boolean).join(' ')}><td className="px-3 py-2 font-medium">{c.name}{isDead && <span className="ml-2 text-xs bg-red-800 text-white rounded px-1">dead</span>}</td><td className="px-3 py-2 text-text-secondary text-right tabular-nums">{Math.round(c.elo)}</td><td className="px-3 py-2 text-text-secondary text-right tabular-nums">{c.timesSeen}</td><td className="px-3 py-2 text-text-secondary text-right tabular-nums">{c.timesPicked}</td><td className="px-3 py-2 text-right tabular-nums"><span className={c.pickRate < deadCardThreshold ? 'text-red-400' : ''}>{(c.pickRate * 100).toFixed(1)}%</span></td><td className="px-3 py-2 text-text-secondary text-right tabular-nums">{c.avgPickPosition > 0 ? c.avgPickPosition.toFixed(1) : '—'}</td><td className="px-3 py-2 text-text-secondary text-right tabular-nums">{c.wheelCount}</td><td className="px-3 py-2 text-text-secondary text-right tabular-nums">{c.p1p1Count}</td><td className="px-3 py-2 text-text-secondary text-right tabular-nums">{inclPct !== undefined ? `${(inclPct * 100).toFixed(1)}%` : '—'}</td><td className="px-3 py-2 text-right"><button type="button" className={[ 'px-2 py-0.5 rounded text-xs font-medium border', isFilteredCard ? 'bg-link text-white border-link' : 'bg-bg text-text-secondary border-border hover:bg-bg-active', ].join(' ')} onClick={() => onSelectCard(c.oracle_id)}>{isFilteredCard ? `Filtered (${visiblePoolCount})` : `View Drafts (${visiblePoolCount})`}</button></td></tr>); })}</tbody>
        </table>
      </div>
      <Flexbox direction="row" justify="between" alignItems="center" className="flex-wrap gap-2 pt-1">
        <Text xs className="text-text-secondary">Page {currentPage} / {totalPages}</Text>
        <Flexbox direction="row" gap="2" alignItems="center">
          <button type="button" onClick={() => { setPage((p) => Math.max(1, p - 1)); onPageChange?.(); }} disabled={currentPage === 1} className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
          <button type="button" onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); onPageChange?.(); }} disabled={currentPage === totalPages} className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
};

const PickCard: React.FC<{ pick: SimulatedPickCard; isSelected: boolean }> = ({ pick, isSelected }) => (
  <div className={['relative rounded border overflow-hidden bg-bg flex-shrink-0', isSelected ? 'border-link-active ring-2 ring-link-active' : 'border-border'].join(' ')} style={{ width: 160 }}>
    {pick.imageUrl ? <img src={pick.imageUrl} alt={pick.name} className="w-full block" /> : <div className="w-full flex items-center justify-center p-1 text-xs text-text-secondary" style={{ height: 224 }}>{pick.name || 'Unknown'}</div>}
    <div className="absolute top-1 left-1 bg-black/80 text-white text-[10px] font-bold rounded px-1 leading-tight">P{pick.packNumber + 1}P{pick.pickNumber}</div>
  </div>
);

const ViewToggle: React.FC<{ mode: 'pool' | 'deck'; onChange: (m: 'pool' | 'deck') => void; hasDeck: boolean; deckLoading?: boolean }> = ({ mode, onChange, hasDeck, deckLoading }) => (
  <Flexbox direction="row" gap="1">
    {(['deck', 'pool'] as const).map((m) => (
      <button
        key={m}
        type="button"
        disabled={m === 'deck' && !hasDeck}
        onClick={() => onChange(m)}
        className={[
          'px-2 py-0.5 rounded text-xs font-medium border',
          mode === m ? 'bg-link text-white border-link' : 'bg-bg text-text-secondary border-border hover:bg-bg-active',
          m === 'deck' && !hasDeck ? 'opacity-40 cursor-not-allowed' : '',
        ].join(' ')}
      >
        {m === 'pool' ? 'Pick Order' : deckLoading ? 'Building…' : 'Deck'}
      </button>
    ))}
  </Flexbox>
);

const CMC_COLS = 8;
const DECK_CARD_W = 160;
const STACK_OFFSET = 30;

const SimDeckView: React.FC<{
  deck: BuiltDeck;
  picksByOracle: Record<string, SimulatedPickCard>;
  cardMeta: Record<string, CardMeta>;
  highlightOracle?: string;
}> = ({ deck, picksByOracle, cardMeta, highlightOracle }) => {
  // Build 3-row grid: [creatures, non-creatures, lands][cmc col]
  const grid: SimulatedPickCard[][][] = Array.from({ length: 3 }, () =>
    Array.from({ length: CMC_COLS }, () => [] as SimulatedPickCard[]),
  );
  for (const oracle_id of deck.mainboard) {
    const meta = cardMeta[oracle_id];
    // Fall back to a synthetic entry for basics/cards added by the deckbuilder (not in pool picks)
    const pick: SimulatedPickCard = picksByOracle[oracle_id] ?? {
      oracle_id,
      name: meta?.name ?? oracle_id,
      imageUrl: meta?.imageUrl ?? '',
      packNumber: 0,
      pickNumber: 0,
    };
    const typeLower = (meta?.type ?? '').toLowerCase();
    const isLand = typeLower.includes('land');
    const isCreature = typeLower.includes('creature');
    const row = isLand ? 2 : isCreature ? 0 : 1;
    const col = Math.min(CMC_COLS - 1, Math.max(0, Math.floor(meta?.cmc ?? 0)));
    grid[row]![col]!.push(pick);
  }

  const sideboardPicks = deck.sideboard.map((id) => {
    const meta = cardMeta[id];
    return picksByOracle[id] ?? { oracle_id: id, name: meta?.name ?? id, imageUrl: meta?.imageUrl ?? '', packNumber: 0, pickNumber: 0 };
  });

  const rowLabels = ['Creatures', 'Non-Creatures', 'Lands'];

  return (
    <div className="p-3 overflow-x-auto">
      <Flexbox direction="col" gap="4">
        {grid.map((row, rowIdx) => {
          const hasCards = row.some((col) => col.length > 0);
          if (!hasCards) return null;
          return (
            <div key={rowIdx}>
              <Text xs className="text-text-secondary mb-1 font-semibold uppercase tracking-wider">{rowLabels[rowIdx]}</Text>
              <div className="flex flex-row gap-1">
                {row.map((stack, colIdx) => {
                  if (stack.length === 0) return <div key={colIdx} style={{ width: DECK_CARD_W }} />;
                  const stackH = Math.round(DECK_CARD_W * 1.4) + (stack.length - 1) * STACK_OFFSET;
                  return (
                    <div key={colIdx} className="relative flex-shrink-0" style={{ width: DECK_CARD_W, height: stackH }}>
                      {stack.map((pick, i) => (
                        <div
                          key={`${pick.oracle_id}-${i}`}
                          className={['absolute rounded border overflow-hidden', pick.oracle_id === highlightOracle ? 'border-link-active ring-1 ring-link-active' : 'border-border'].join(' ')}
                          style={{ top: i * STACK_OFFSET, width: DECK_CARD_W, zIndex: i }}
                        >
                          {pick.imageUrl
                            ? <img src={pick.imageUrl} alt={pick.name} className="w-full block" />
                            : <div className="w-full flex items-center justify-center p-1 text-xs text-text-secondary bg-bg" style={{ height: Math.round(DECK_CARD_W * 1.4) }}>{pick.name}</div>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {sideboardPicks.length > 0 && (
          <div>
            <Text xs className="text-text-secondary mb-1 font-semibold uppercase tracking-wider">Sideboard ({sideboardPicks.length})</Text>
            <div className="flex flex-row flex-wrap gap-1 opacity-75">
              {sideboardPicks.map((pick) => (
                <div key={pick.oracle_id} className="rounded border border-border overflow-hidden flex-shrink-0" style={{ width: 110 }}>
                  {pick.imageUrl ? <img src={pick.imageUrl} alt={pick.name} className="w-full block" /> : <div className="text-xs p-1 text-text-secondary bg-bg" style={{ height: 154 }}>{pick.name}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </Flexbox>
    </div>
  );
};

const PoolExpansionContent: React.FC<{
  pool: SimulatedPool;
  mode: 'pool' | 'deck';
  deck: BuiltDeck | null;
  cardMeta: Record<string, CardMeta>;
  highlightOracle?: string;
}> = ({ pool, mode, deck, cardMeta, highlightOracle }) => {
  if (mode === 'deck' && deck && (deck.mainboard.length > 0 || deck.sideboard.length > 0)) {
    const picksByOracle: Record<string, SimulatedPickCard> = {};
    for (const pick of pool.picks) picksByOracle[pick.oracle_id] = pick;
    return <SimDeckView deck={deck} picksByOracle={picksByOracle} cardMeta={cardMeta} highlightOracle={highlightOracle} />;
  }
  const orderedPicks = [...pool.picks].sort((a, b) => a.packNumber - b.packNumber || a.pickNumber - b.pickNumber);
  return (
    <div className="p-3 overflow-x-auto">
      <Flexbox direction="col" gap="2">
        {[0, 1, 2].map((packNum) => {
          const packPicks = orderedPicks.filter((p) => p.packNumber === packNum);
          if (packPicks.length === 0) return null;
          return (
            <div key={packNum}>
              <Text xs className="text-text-secondary mb-1 font-semibold uppercase tracking-wider">Pack {packNum + 1}</Text>
              <div className="flex flex-row gap-1.5 flex-wrap">
                {packPicks.map((pick) => <PickCard key={`${pick.packNumber}-${pick.pickNumber}`} pick={pick} isSelected={pick.oracle_id === highlightOracle} />)}
              </div>
            </div>
          );
        })}
      </Flexbox>
    </div>
  );
};

const CardPoolView: React.FC<{ card: CardStats; pools: SimulatedPool[]; deckBuilds: BuiltDeck[] | null; deckLoading: boolean; cardMeta: Record<string, CardMeta>; onClose: () => void }> = ({ card, pools, deckBuilds, deckLoading, cardMeta, onClose }) => {
  const [expandedPool, setExpandedPool] = useState<number | null>(pools[0]?.poolIndex ?? null);
  const [viewMode, setViewMode] = useState<'pool' | 'deck'>('deck');
  const [poolLocationFilter, setPoolLocationFilter] = useState<DeckLocationFilter>('all');
  const hasDeck = !!deckBuilds && deckBuilds.length > 0;

  const visiblePools = pools.filter((pool) => {
    if (!deckBuilds || poolLocationFilter === 'all') return true;
    const d = deckBuilds[pool.poolIndex];
    if (!d) return true;
    if (poolLocationFilter === 'deck') return d.mainboard.includes(card.oracle_id);
    if (poolLocationFilter === 'sideboard') return d.sideboard.includes(card.oracle_id);
    return true;
  });

  return (
    <Card className="border-border">
      <CardHeader>
        <Flexbox direction="row" justify="between" alignItems="center" className="flex-wrap gap-3">
          <div>
            <Text semibold>Draft Breakdown</Text>
            <div className="mt-0.5"><Text xs className="text-text-secondary">Matching decks that include {card.name}</Text></div>
          </div>
          <Flexbox direction="row" gap="3" alignItems="center" className="flex-wrap">
            {hasDeck && (
              <Flexbox direction="row" gap="1" className="flex-wrap rounded border border-border bg-bg-accent/70 px-2 py-1">
                {(['all', 'deck', 'sideboard'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPoolLocationFilter(v)}
                    className={[
                      'px-2 py-0.5 rounded text-xs font-medium border',
                      poolLocationFilter === v ? 'bg-link text-white border-link' : 'bg-bg text-text-secondary border-border hover:bg-bg-active',
                    ].join(' ')}
                  >
                    {v === 'all' ? 'In pool' : v === 'deck' ? 'In deck' : 'In sideboard'}
                  </button>
                ))}
              </Flexbox>
            )}
            <Flexbox direction="row" gap="1" className="flex-wrap rounded border border-border bg-bg-accent/70 px-2 py-1">
              <ViewToggle mode={viewMode} onChange={setViewMode} hasDeck={hasDeck} deckLoading={deckLoading} />
            </Flexbox>
            <button type="button" onClick={onClose} className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active" title="Close">✕</button>
          </Flexbox>
        </Flexbox>
      </CardHeader>
      <CardBody className="pt-3">
        {visiblePools.length === 0 ? <Text sm className="text-text-secondary">No pools match the current filter.</Text> : (
          <Flexbox direction="col" gap="4">{visiblePools.map((pool) => {
            const isExpanded = expandedPool === pool.poolIndex;
            const orderedPicks = [...pool.picks].sort((a, b) => a.packNumber - b.packNumber || a.pickNumber - b.pickNumber);
            const thisCardPick = orderedPicks.find((p) => p.oracle_id === card.oracle_id);
            const pickLabel = thisCardPick ? `P${thisCardPick.packNumber + 1}P${thisCardPick.pickNumber}` : '';
            return (
              <div key={pool.poolIndex} className="rounded-lg border border-border/80 overflow-hidden bg-bg shadow-sm">
                <button type="button" className="w-full flex items-center justify-between gap-3 px-3 py-3 bg-bg-accent/60 hover:bg-bg-active text-left border-b border-border/70" onClick={() => setExpandedPool(isExpanded ? null : pool.poolIndex)}>
                  <Flexbox direction="row" gap="2" alignItems="center" className="flex-wrap min-w-0">
                    <Text sm semibold>Sim {pool.draftIndex + 1} · Player {pool.seatIndex + 1}</Text>
                    <span className="text-[11px] bg-bg text-text-secondary rounded px-1.5 py-0.5 border border-border/80">{pool.archetype}</span>
                    {pickLabel && <span className="text-[11px] bg-link/15 text-link rounded px-1.5 py-0.5 font-semibold border border-link/20">{card.name} @ {pickLabel}</span>}
                  </Flexbox>
                  <Text xs className="text-text-secondary flex-shrink-0">{isExpanded ? '▲' : '▼'} {pool.picks.length} picks</Text>
                </button>
                {isExpanded && <PoolExpansionContent pool={pool} mode={viewMode} deck={deckBuilds?.[pool.poolIndex] ?? null} cardMeta={cardMeta} highlightOracle={card.oracle_id} />}
              </div>
            );
          })}</Flexbox>
        )}
      </CardBody>
    </Card>
  );
};

const ArchetypePoolList: React.FC<{ archetype: string; title?: string; pools: SimulatedPool[]; deckBuilds: BuiltDeck[] | null; deckLoading: boolean; cardMeta: Record<string, CardMeta>; onClose: () => void }> = ({ archetype, title, pools, deckBuilds, deckLoading, cardMeta, onClose }) => {
  const [expandedPool, setExpandedPool] = useState<number | null>(null);
  const hasDeck = !!deckBuilds && deckBuilds.length > 0;
  const [viewMode, setViewMode] = useState<'pool' | 'deck'>('pool');
  useEffect(() => {
    if (hasDeck) setViewMode('deck');
  }, [hasDeck]);
  return (
    <Card className="border-border">
      <CardHeader>
        <Flexbox direction="row" justify="between" alignItems="center" className="flex-wrap gap-3">
          <div className="min-w-0">
            <div><Text semibold>Draft Breakdown</Text></div>
            <div className="mt-0.5"><Text xs className="text-text-secondary">{title ?? archetypeFullName(archetype)} · {pools.length} seats</Text></div>
          </div>
          <Flexbox direction="row" gap="2" alignItems="center" className="flex-wrap rounded border border-border bg-bg-accent/60 px-2 py-1">
            <ViewToggle mode={viewMode} onChange={setViewMode} hasDeck={hasDeck} deckLoading={deckLoading} />
            <button type="button" onClick={onClose} className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active" title="Close">✕</button>
          </Flexbox>
        </Flexbox>
      </CardHeader>
      <CardBody className="pt-2">
        <Flexbox direction="col" gap="3">
          {pools.map((pool) => {
            const isExpanded = expandedPool === pool.poolIndex;
            return (
              <div key={pool.poolIndex} className="rounded-lg border border-border/80 overflow-hidden bg-bg shadow-sm">
                <button type="button" className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-bg-accent/60 hover:bg-bg-active text-left border-b border-border/70" onClick={() => setExpandedPool(isExpanded ? null : pool.poolIndex)}>
                  <Flexbox direction="row" gap="2" alignItems="center" className="flex-wrap min-w-0">
                    <Text sm semibold>Sim {pool.draftIndex + 1} · Player {pool.seatIndex + 1}</Text>
                    <span className="text-[11px] bg-bg text-text-secondary rounded px-1.5 py-0.5 border border-border/80">{pool.archetype}</span>
                  </Flexbox>
                  <Text xs className="text-text-secondary flex-shrink-0">{isExpanded ? '▲' : '▼'} {pool.picks.length} picks</Text>
                </button>
                {isExpanded && <PoolExpansionContent pool={pool} mode={viewMode} deck={deckBuilds?.[pool.poolIndex] ?? null} cardMeta={cardMeta} />}
              </div>
            );
          })}
        </Flexbox>
      </CardBody>
    </Card>
  );
};

const DraftVsEloTable: React.FC<{ cardStats: CardStats[] }> = ({ cardStats }) => {
  const picked = cardStats.filter((c) => c.timesPicked > 0 && c.avgPickPosition > 0);
  const eloRankMap = new Map([...picked].sort((a, b) => b.elo - a.elo).map((c, i) => [c.oracle_id, i + 1]));
  const draftRankMap = new Map([...picked].sort((a, b) => a.avgPickPosition - b.avgPickPosition).map((c, i) => [c.oracle_id, i + 1]));
  const rows = picked.map((c) => { const eloRank = eloRankMap.get(c.oracle_id) ?? 0; const draftRank = draftRankMap.get(c.oracle_id) ?? 0; return { oracle_id: c.oracle_id, name: c.name, elo: Math.round(c.elo), eloRank, draftRank, delta: eloRank - draftRank, avgPickPosition: c.avgPickPosition, pickRate: c.pickRate }; });
  const gainers = [...rows].sort((a, b) => b.delta - a.delta).slice(0, 20);
  const losers = [...rows].sort((a, b) => a.delta - b.delta).slice(0, 20);
  const cols = ['Card', 'Elo', 'Elo Rank', 'Draft Rank', 'Delta', 'Avg Position', 'Pick Rate'];
  const TH = () => <thead className="bg-bg-accent"><tr>{cols.map((h, idx) => <th key={h} className={['px-3 py-2 text-xs font-medium uppercase tracking-wider', idx === 0 ? 'text-left' : 'text-right'].join(' ')}>{h}</th>)}</tr></thead>;
  const DR: React.FC<{ row: typeof rows[0] }> = ({ row }) => <tr className="hover:bg-bg-active"><td className="px-3 py-2 font-medium">{row.name}</td><td className="px-3 py-2 text-text-secondary text-right tabular-nums">{row.elo}</td><td className="px-3 py-2 text-text-secondary text-right tabular-nums">#{row.eloRank}</td><td className="px-3 py-2 text-text-secondary text-right tabular-nums">#{row.draftRank}</td><td className="px-3 py-2 text-right tabular-nums"><span className={row.delta > 0 ? 'text-green-400 font-medium' : row.delta < 0 ? 'text-red-400 font-medium' : ''}>{row.delta > 0 ? `+${row.delta}` : row.delta}</span></td><td className="px-3 py-2 text-text-secondary text-right tabular-nums">{row.avgPickPosition.toFixed(1)}</td><td className="px-3 py-2 text-text-secondary text-right tabular-nums">{(row.pickRate * 100).toFixed(1)}%</td></tr>;
  return (
    <Row className="gap-4">
      {[{ title: 'Context Overperformers (Top 20)', sub: 'Picked higher than Elo suggests — cards that outperform their rating in this cube', data: gainers }, { title: 'Context Underperformers (Top 20)', sub: 'High Elo but drafted lower — situational or power level mismatch', data: losers }].map(({ title, sub, data }) => (
        <Col key={title} xs={12} md={6}><Card className="h-full"><CardHeader><div><div><Text semibold>{title}</Text></div><div className="mt-0.5"><Text xs className="text-text-secondary">{sub}</Text></div></div></CardHeader><CardBody><div className="overflow-x-auto rounded border border-border bg-bg"><table className="min-w-full divide-y divide-border text-sm"><TH /><tbody className="divide-y divide-border">{data.map((row) => <DR key={row.oracle_id} row={row} />)}</tbody></table></div></CardBody></Card></Col>
      ))}
    </Row>
  );
};

const SkeletonCardImage: React.FC<{ card: SkeletonCard; size: number }> = ({ card, size }) => (
  <div className="relative flex-shrink-0" style={{ width: size }} title={`${card.name} — ${(card.fraction * 100).toFixed(0)}% of pools`}>
    {card.imageUrl
      ? <img src={card.imageUrl} alt={card.name} className="w-full rounded border border-border shadow-sm" />
      : <div className="w-full flex items-center justify-center text-xs text-text-secondary bg-bg-accent rounded border border-border p-1 text-center shadow-sm" style={{ height: Math.round(size * 1.4) }}>{card.name}</div>
    }
    <div className="absolute bottom-1 right-1 bg-black/70 text-white font-bold rounded px-1 py-0.5 leading-tight shadow-sm" style={{ fontSize: 9 }}>
      {(card.fraction * 100).toFixed(0)}%
    </div>
  </div>
);

const ArchetypeSkeletonSection: React.FC<{
  skeletons: ArchetypeSkeleton[];
  k: number;
  onSetK: (k: number) => void;
  coreThreshold: number;
  onSetCoreThreshold: (v: number) => void;
  onRecluster: () => void;
  totalPools: number;
  selectedSkeletonId: number | null;
  onSelectSkeleton: (id: number | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ skeletons, k, onSetK, coreThreshold, onSetCoreThreshold, onRecluster, totalPools, selectedSkeletonId, onSelectSkeleton, isOpen, onToggle }) => (
  <ArchetypeSkeletonSectionInner
    skeletons={skeletons}
    k={k}
    onSetK={onSetK}
    coreThreshold={coreThreshold}
    onSetCoreThreshold={onSetCoreThreshold}
    onRecluster={onRecluster}
    totalPools={totalPools}
    selectedSkeletonId={selectedSkeletonId}
    onSelectSkeleton={onSelectSkeleton}
    isOpen={isOpen}
    onToggle={onToggle}
  />
);

const ArchetypeSkeletonSectionInner: React.FC<{
  skeletons: ArchetypeSkeleton[];
  k: number;
  onSetK: (k: number) => void;
  coreThreshold: number;
  onSetCoreThreshold: (v: number) => void;
  onRecluster: () => void;
  totalPools: number;
  selectedSkeletonId: number | null;
  onSelectSkeleton: (id: number | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ skeletons, k, onSetK, coreThreshold, onSetCoreThreshold, onRecluster, totalPools, selectedSkeletonId, onSelectSkeleton, isOpen, onToggle }) => {
  const [showAllClusters, setShowAllClusters] = useState(false);
  const [reclusterFlash, setReclusterFlash] = useState(false);
  const handleRecluster = () => {
    onRecluster();
    setReclusterFlash(true);
    setTimeout(() => setReclusterFlash(false), 1200);
  };
  const visibleSkeletons = skeletons.slice(0, 2);
  const hiddenSkeletons = skeletons.slice(2);

  const renderSkeleton = (skeleton: ArchetypeSkeleton, skIdx: number) => (
    <div key={skeleton.clusterId} className={['rounded-lg overflow-hidden border bg-bg shadow-sm', selectedSkeletonId === skeleton.clusterId ? 'border-link-active ring-1 ring-link-active' : 'border-border/80'].join(' ')}>
      <button
        type="button"
        className="w-full px-4 py-3 bg-bg-accent/60 hover:bg-bg-active flex items-center gap-2.5 flex-wrap text-left border-b border-border/70"
        onClick={() => onSelectSkeleton(selectedSkeletonId === skeleton.clusterId ? null : skeleton.clusterId)}
      >
        <span className="text-base font-semibold tracking-tight">Cluster {skIdx + 1}</span>
        <span className="text-[11px] bg-bg border border-border/80 rounded px-2 py-0.5 text-text-secondary">
          {skeleton.poolCount} seats ({((skeleton.poolCount / totalPools) * 100).toFixed(1)}% of {totalPools})
        </span>
        {skeleton.lockPairs.length > 0 && (
          <span className="text-xs bg-yellow-900/40 text-yellow-300 border border-yellow-700 rounded px-2 py-0.5">
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-yellow-500 text-black font-bold mr-1" style={{ fontSize: 9 }}>!</span>
            {skeleton.lockPairs.length} lock pair{skeleton.lockPairs.length > 1 ? 's' : ''}
          </span>
        )}
        {selectedSkeletonId === skeleton.clusterId && (
          <span className="text-xs bg-link/20 text-link border border-link/30 rounded px-2 py-0.5 ml-auto">Filtering ✕</span>
        )}
      </button>
      <div className="p-4 md:p-5">
        {skeleton.coreCards.length > 0 && (
          <div className="mb-5">
            <Text xs className="text-text-secondary font-semibold uppercase tracking-[0.16em] mb-2.5">Core (&gt;={coreThreshold}% of pools)</Text>
            <div className="flex flex-row flex-wrap gap-2">
              {skeleton.coreCards.map((card) => <SkeletonCardImage key={card.oracle_id} card={card} size={140} />)}
            </div>
          </div>
        )}
        {skeleton.occasionalCards.length > 0 && (
          <div className="mb-4">
            <Text xs className="text-text-secondary/80 font-medium uppercase tracking-[0.14em] mb-1.5">Support ({Math.round(coreThreshold / 2)}-{coreThreshold - 1}% of pools)</Text>
            <div className="flex flex-row flex-wrap gap-1.5">
              {skeleton.occasionalCards.map((card) => <SkeletonCardImage key={card.oracle_id} card={card} size={110} />)}
            </div>
          </div>
        )}
        {skeleton.lockPairs.length > 0 && (
          <div className="pt-1">
            <Text xs className="text-text-secondary font-semibold uppercase tracking-[0.16em] mb-2">Lock pairs</Text>
            <Flexbox direction="col" gap="1">
              {skeleton.lockPairs.map((pair) => (
                <div key={`${pair.oracle_id_a}-${pair.oracle_id_b}`} className="flex items-center gap-2 text-sm">
                  <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-yellow-500 text-black font-bold flex-shrink-0" style={{ fontSize: 9 }}>!</span>
                  <span className="font-medium">{pair.nameA}</span>
                  <span className="text-text-secondary">+</span>
                  <span className="font-medium">{pair.nameB}</span>
                  <span className="text-text-secondary ml-1">{(pair.coOccurrenceRate * 100).toFixed(0)}% co-occurrence</span>
                </div>
              ))}
            </Flexbox>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <Flexbox direction="row" justify="between" alignItems="center" className="flex-wrap gap-2">
          <button type="button" className="flex-1 text-left" onClick={onToggle}>
            <Flexbox direction="row" gap="2" alignItems="center">
              <Text semibold>Archetypes</Text>
              {!isOpen && <span className="text-xs text-text-secondary font-normal">{skeletons.length} clusters</span>}
            </Flexbox>
            <Text xs className="text-text-secondary mt-0.5">Decks clustered by card-overlap similarity</Text>
          </button>
          <div className="flex flex-row items-center gap-2 flex-shrink-0">
            {isOpen && (
              <>
                <label className="text-xs font-medium text-text-secondary whitespace-nowrap">Clusters</label>
                <NumericInput min={2} max={16} value={k} onChange={onSetK} className="w-14" />
                <label className="text-xs font-medium text-text-secondary whitespace-nowrap">Core %</label>
                <NumericInput min={10} max={95} value={coreThreshold} onChange={onSetCoreThreshold} className="w-14" />
                <button type="button" onClick={handleRecluster} className={['whitespace-nowrap px-2 py-1 rounded text-xs font-medium border transition-colors', reclusterFlash ? 'bg-green-700 text-white border-green-600' : 'bg-bg-accent border-border hover:bg-bg-active'].join(' ')}>{reclusterFlash ? '✓ Done' : 'Re-cluster'}</button>
              </>
            )}
            <button type="button" onClick={onToggle} className="whitespace-nowrap px-2 py-1 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active">
              {isOpen ? '▲ Hide' : '▼ Show'}
            </button>
          </div>
        </Flexbox>
      </CardHeader>
      <Collapse isOpen={isOpen}>
        <CardBody>
          <Flexbox direction="col" gap="6">
            {visibleSkeletons.map((skeleton, idx) => renderSkeleton(skeleton, idx))}
            {hiddenSkeletons.length > 0 && (
              <>
                <Collapse isOpen={showAllClusters} className="flex flex-col gap-6">
                  {hiddenSkeletons.map((skeleton, idx) => renderSkeleton(skeleton, idx + 2))}
                </Collapse>
                <button
                  type="button"
                  onClick={() => setShowAllClusters((open) => !open)}
                  className="self-start px-2 py-1 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active"
                >
                  {showAllClusters ? 'Show fewer clusters' : `Show ${hiddenSkeletons.length} more cluster${hiddenSkeletons.length === 1 ? '' : 's'}`}
                </button>
              </>
            )}
          </Flexbox>
        </CardBody>
      </Collapse>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

interface CubeDraftSimulatorPageProps { cube: Cube; canRun: boolean; }

const CubeDraftSimulatorPage: React.FC<CubeDraftSimulatorPageProps> = ({ cube, canRun }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const cubeId = getCubeId(cube);

  // Controls
  const [numDrafts, setNumDrafts] = useState(50);
  const [numSeats, setNumSeats] = useState(8);
  const [deadCardThresholdPct, setDeadCardThresholdPct] = useState(5);

  // Simulation state
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [simulating, setSimulating] = useState(false); // true while ML call is in flight
  const [simProgress, setSimProgress] = useState(0); // 0–100
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Run history & display
  const [runs, setRuns] = useState<SimulationRunEntry[]>([]);
  const [displayRunData, setDisplayRunData] = useState<SimulationRunData | null>(null);
  const [currentRunSetup, setCurrentRunSetup] = useState<SimulationSetupResponse | null>(null);
  const [selectedTs, setSelectedTs] = useState<number | null>(null);
  const [loadingRun, setLoadingRun] = useState(false);
  const [deleteRunModalOpen, setDeleteRunModalOpen] = useState(false);
  const [runPendingDelete, setRunPendingDelete] = useState<SimulationRunEntry | null>(null);

  // Card pool view
  const [selectedCardOracle, setSelectedCardOracle] = useState<string | null>(null);
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [selectedSkeletonId, setSelectedSkeletonId] = useState<number | null>(null);
  const poolViewRef = useRef<HTMLDivElement>(null);
  const detailedViewRef = useRef<HTMLDivElement>(null);

  // Section collapse state (default collapsed)
  const [archetypesOpen, setArchetypesOpen] = useState(true);
  const [cardStatsOpen, setCardStatsOpen] = useState(true);

  // Archetype skeleton clustering
  const [clusterK, setClusterK] = useState(10);
  const [clusterSeed, setClusterSeed] = useState(0);
  const [coreThreshold, setCoreThreshold] = useState(60);
  const [deckBuildsLoading, setDeckBuildsLoading] = useState(false);

  // Reconstruct SimulatedPool[] from slim pools for display (works for both fresh and historical)
  const simulatedPools = useMemo(
    () => displayRunData ? reconstructSimulatedPools(displayRunData.slimPools, displayRunData.cardMeta) : [],
    [displayRunData],
  );

  // Build decks in batches; returns decks + any basic land metadata from the server
  const buildAllDecks = useCallback(async (slimPools: SlimPool[]): Promise<{ decks: BuiltDeck[]; basicCardMeta: Record<string, CardMeta> } | null> => {
    if (slimPools.length === 0) return { decks: [], basicCardMeta: {} };
    const BATCH_SIZE = 10;
    const allResults: BuiltDeck[] = [];
    const basicCardMeta: Record<string, CardMeta> = {};
    try {
      for (let i = 0; i < slimPools.length; i += BATCH_SIZE) {
        const batch = slimPools.slice(i, i + BATCH_SIZE);
        const inputs = batch.map((p) => p.picks.map((pick) => pick.oracle_id));
        const res = await csrfFetch(`/cube/api/simulatedeckbuild/${encodeURIComponent(cubeId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs }),
        });
        const json = await res.json();
        if (json.success && Array.isArray(json.results)) {
          allResults.push(...json.results);
          Object.assign(basicCardMeta, json.basicCardMeta ?? {});
        } else {
          console.error('simulatedeckbuild batch failed:', json);
          return null;
        }
      }
      return { decks: allResults, basicCardMeta };
    } catch (err) {
      console.error('simulatedeckbuild fetch error:', err);
      return null;
    }
  }, [csrfFetch, cubeId]);

  // Load run history on mount
  useEffect(() => {
    fetch(`/cube/api/simulatesave/${encodeURIComponent(cubeId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setRuns(data.runs ?? []);
          if (data.latestRunData) {
            setDisplayRunData(data.latestRunData);
            setCurrentRunSetup(data.latestRunData.setupData ?? null);
            setSelectedTs(data.runs?.[0]?.ts ?? null);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load simulation history:', err);
      });
  }, [cubeId]);

  const [loadRunError, setLoadRunError] = useState<string | null>(null);
  const loadRunInFlight = useRef(false);

  const handleLoadRun = useCallback(async (ts: number) => {
    if (ts === selectedTs && displayRunData) return;
    if (loadRunInFlight.current) return;
    loadRunInFlight.current = true;
    setLoadingRun(true);
    setLoadRunError(null);
    setSelectedCardOracle(null);
    setSelectedArchetype(null);
    setSelectedSkeletonId(null);
    try {
      const res = await fetch(`/cube/api/simulatesave/${encodeURIComponent(cubeId)}/${ts}`);
      const json = await res.json();
      if (json.success) {
        setDisplayRunData(json.runData);
        setCurrentRunSetup(json.runData.setupData ?? null);
        setSelectedTs(ts);
      } else {
        setLoadRunError(json.message ?? 'Failed to load run');
      }
    } catch (err) {
      setLoadRunError(err instanceof Error ? err.message : 'Failed to load run');
    } finally {
      setLoadingRun(false);
      loadRunInFlight.current = false;
    }
  }, [cubeId, selectedTs, displayRunData]);

  const handleDeleteRun = useCallback(async (ts: number) => {
    try {
      const res = await csrfFetch(`/cube/api/simulatesave/${encodeURIComponent(cubeId)}/${ts}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) return;

      const nextRuns = json.runs ?? [];
      setRuns(nextRuns);
      setSelectedCardOracle(null);
      setSelectedArchetype(null);
      setSelectedSkeletonId(null);

      if (selectedTs === ts) {
        setDisplayRunData(json.latestRunData ?? null);
        setCurrentRunSetup(json.latestRunData?.setupData ?? null);
        setSelectedTs(nextRuns[0]?.ts ?? null);
      }
    } catch (err) {
      console.error('Failed to delete run:', err);
    }
  }, [csrfFetch, cubeId, selectedTs]);

  const handleStart = useCallback(async () => {
    setStatus('running'); setSimulating(true); setSimProgress(0); setErrorMsg(null); setSelectedCardOracle(null); setSelectedArchetype(null); setSelectedSkeletonId(null);
    try {
      const setupRes = await csrfFetch(`/cube/api/simulatesetup/${encodeURIComponent(cubeId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ numDrafts, numSeats }) });
      const setupData = await setupRes.json();
      if (!setupData.success) { setStatus('failed'); setErrorMsg(setupData.message ?? 'Failed to set up simulation'); setSimulating(false); if (setupData.hoursRemaining) setRuns((r) => r); return; }

      const report = await runClientSimulation(setupData as SimulationSetupResponse, numDrafts, deadCardThresholdPct / 100, setSimProgress);
      setCurrentRunSetup(setupData as SimulationSetupResponse);
      setSimulating(false);

      // Build decks for all pools before saving
      setDeckBuildsLoading(true);
      const deckResult = await buildAllDecks(report.slimPools);
      setDeckBuildsLoading(false);
      if (!deckResult) {
        setStatus('failed');
        setErrorMsg('Deck building failed. The simulation ran successfully but decks could not be built.');
        return;
      }

      // Assemble run data and save to S3; merge basic land metadata into cardMeta
      const { simulatedPools: _derived, ...runDataBase } = report;
      const mergedCardMeta = { ...runDataBase.cardMeta, ...deckResult.basicCardMeta };
      const runData = { ...runDataBase, cardMeta: mergedCardMeta, deckBuilds: deckResult.decks, setupData: report.setupData, randomTrashByPool: report.randomTrashByPool };
      const saveRes = await csrfFetch(`/cube/api/simulatesave/${encodeURIComponent(cubeId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(runData) });
      const saveJson = await saveRes.json();
      if (!saveJson.success) {
        setStatus('failed');
        setErrorMsg(saveJson.message ?? 'Failed to save simulation results');
        return;
      }

      setStatus('completed');
      setDisplayRunData(runData);
      setSelectedTs(saveJson.ts ?? null);

      fetch(`/cube/api/simulatesave/${encodeURIComponent(cubeId)}`)
        .then((r) => r.json())
        .then((data) => { if (data.success) setRuns(data.runs ?? []); })
        .catch((err) => { console.error('Failed to refresh run history:', err); });
    } catch (err) {
      setSimulating(false);
      setDeckBuildsLoading(false);
      setStatus('failed');
      setErrorMsg(err instanceof Error ? err.message : 'Simulation failed');
    }
  }, [csrfFetch, cubeId, numDrafts, numSeats, deadCardThresholdPct, buildAllDecks]);

  const COOLDOWN_MS = 24 * 60 * 60 * 1000;
  const isRunning = status === 'running';
  const lastRunTs = runs[0]?.ts ?? null;
  const cooldownActive = !!lastRunTs && (Date.now() - lastRunTs) < COOLDOWN_MS;
  const hoursUntilNext = lastRunTs ? Math.ceil((COOLDOWN_MS - (Date.now() - lastRunTs)) / 3600000) : 0;

  const activeDecks = displayRunData?.deckBuilds ?? null;
  const displayedPools = useMemo(() => {
    if (!displayRunData) return [];
    if (!activeDecks || activeDecks.length !== simulatedPools.length) return simulatedPools;
    return simulatedPools.map((pool, idx) => ({
      ...pool,
      archetype: assessDeckColors(activeDecks[idx]?.mainboard ?? [], displayRunData.cardMeta),
    }));
  }, [displayRunData, activeDecks, simulatedPools]);
  const displayedArchetypeDistribution = useMemo(() => {
    if (!displayRunData) return [];
    if (!activeDecks || activeDecks.length !== simulatedPools.length) return displayRunData.archetypeDistribution;
    const counts = new Map<string, number>();
    for (const pool of displayedPools) counts.set(pool.archetype, (counts.get(pool.archetype) ?? 0) + 1);
    const totalPools = displayedPools.length || 1;
    return [...counts.entries()]
      .map(([colorPair, count]) => ({ colorPair, count, percentage: count / totalPools }))
      .sort((a, b) => b.count - a.count);
  }, [displayRunData, activeDecks, simulatedPools.length, displayedPools]);
  const skeletons = useMemo(
    () =>
      displayRunData && displayRunData.slimPools.length > 0
        ? computeSkeletons(displayRunData.slimPools, displayRunData.cardMeta, clusterK, coreThreshold, activeDecks)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayRunData, clusterK, clusterSeed, coreThreshold, activeDecks],
  );

  const selectedCard = displayRunData && selectedCardOracle ? displayRunData.cardStats.find((c) => c.oracle_id === selectedCardOracle) ?? null : null;
  const activeFilterPoolIndexSet = useMemo(() => {
    const filterSets: Set<number>[] = [];

    if (selectedSkeletonId !== null) {
      const skeleton = skeletons.find((s) => s.clusterId === selectedSkeletonId);
      if (skeleton) filterSets.push(new Set<number>(skeleton.poolIndices));
    }

    if (selectedArchetype) {
      const colorSet = new Set<number>();
      for (const pool of displayedPools) {
        if (pool.archetype === selectedArchetype) colorSet.add(pool.poolIndex);
      }
      filterSets.push(colorSet);
    }

    if (selectedCard) {
      filterSets.push(new Set<number>(selectedCard.poolIndices));
    }

    if (filterSets.length === 0) return null;

    const [first, ...rest] = filterSets;
    const intersection = new Set<number>(first);
    for (const value of [...intersection]) {
      if (!rest.every((set) => set.has(value))) intersection.delete(value);
    }
    return intersection;
  }, [selectedArchetype, selectedSkeletonId, selectedCard, skeletons, displayedPools]);

  const filteredDecks = useMemo(() => {
    if (!activeDecks) return null;
    if (!activeFilterPoolIndexSet) return activeDecks;
    return activeDecks.filter((_, idx) => activeFilterPoolIndexSet.has(idx));
  }, [activeDecks, activeFilterPoolIndexSet]);
  const deckInclusionPct = useMemo<Map<string, number>>(() => {
    if (!filteredDecks || filteredDecks.length === 0) return new Map();
    const mainboardCounts = new Map<string, number>();
    const poolCounts = new Map<string, number>();
    for (const d of filteredDecks) {
      for (const o of d.mainboard) {
        mainboardCounts.set(o, (mainboardCounts.get(o) ?? 0) + 1);
        poolCounts.set(o, (poolCounts.get(o) ?? 0) + 1);
      }
      for (const o of d.sideboard) {
        poolCounts.set(o, (poolCounts.get(o) ?? 0) + 1);
      }
    }
    const result = new Map<string, number>();
    for (const [o, inDeck] of mainboardCounts) {
      const inPool = poolCounts.get(o) ?? inDeck;
      result.set(o, inDeck / inPool);
    }
    return result;
  }, [filteredDecks]);
  const inDeckOracles = useMemo<Set<string> | null>(
    () => (filteredDecks ? new Set(deckInclusionPct.keys()) : null),
    [filteredDecks, deckInclusionPct],
  );
  const inSideboardOracles = useMemo<Set<string> | null>(() => {
    if (!filteredDecks) return null;
    const s = new Set<string>();
    for (const d of filteredDecks) for (const o of d.sideboard) s.add(o);
    return s;
  }, [filteredDecks]);

  const visibleCardStats = useMemo(() => {
    if (!displayRunData) return [];
    if (!activeFilterPoolIndexSet) return displayRunData.cardStats;
    if (currentRunSetup) return computeFilteredCardStats(currentRunSetup, displayRunData, activeFilterPoolIndexSet);
    return displayRunData.cardStats.filter((c) => c.poolIndices.some((i) => activeFilterPoolIndexSet.has(i)));
  }, [displayRunData, activeFilterPoolIndexSet, currentRunSetup]);
  const selectedCardStats = useMemo(
    () => (selectedCardOracle ? visibleCardStats.find((c) => c.oracle_id === selectedCardOracle) ?? null : null),
    [visibleCardStats, selectedCardOracle],
  );
  const visiblePoolCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cardStat of visibleCardStats) counts.set(cardStat.oracle_id, cardStat.poolIndices.length);
    return counts;
  }, [visibleCardStats]);
  const hasApproximateFilteredStats = !!(activeFilterPoolIndexSet && !currentRunSetup);

  const selectedPools = selectedCard
    ? (selectedCardStats?.poolIndices ?? selectedCard.poolIndices)
        .map((i) => displayedPools[i])
        .filter((p): p is SimulatedPool => Boolean(p) && (!activeFilterPoolIndexSet || activeFilterPoolIndexSet.has(p.poolIndex)))
    : [];

  const hasPoolView = !!(selectedCard || (selectedArchetype && !selectedCard && !selectedSkeletonId) || (selectedSkeletonId !== null && !selectedCard && !selectedArchetype));

  // Scroll to Detailed View whenever a new selection is made
  useEffect(() => {
    if ((selectedCardOracle || selectedArchetype || selectedSkeletonId !== null) && detailedViewRef.current) {
      detailedViewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedCardOracle, selectedArchetype, selectedSkeletonId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (selectedSkeletonId !== null) {
      const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
      const skIdx = skeletons.indexOf(sk!);
      if (sk) chips.push(`Cluster: ${skIdx + 1}`);
    }
    if (selectedArchetype) chips.push(`Deck Color: ${archetypeFullName(selectedArchetype)}`);
    if (selectedCard) chips.push(`Decks Containing: ${selectedCard.name}`);
    return chips;
  }, [selectedSkeletonId, selectedArchetype, selectedCard, skeletons]);

  const activeFilterSummary = useMemo(() => {
    if (activeFilterChips.length === 0) return null;
    return activeFilterChips.join(' · ');
  }, [activeFilterChips]);

  const detailedViewScopeChips = useMemo(() => {
    const chips: string[] = [];
    if (selectedCard) chips.push(selectedCard.name);
    if (selectedSkeletonId !== null) {
      const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
      const skIdx = skeletons.indexOf(sk!);
      if (sk) chips.push(`Cluster ${skIdx + 1}`);
    }
    if (selectedArchetype) chips.push(archetypeFullName(selectedArchetype));
    return chips;
  }, [selectedCard, selectedSkeletonId, selectedArchetype, skeletons]);

  const selectedCardScopeLabel = useMemo(() => {
    if (!selectedCard) return null;
    const scopeParts: string[] = [];
    if (selectedSkeletonId !== null) {
      const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
      const skIdx = skeletons.indexOf(sk!);
      if (sk) scopeParts.push(`Cluster ${skIdx + 1}`);
    }
    if (selectedArchetype) scopeParts.push(archetypeFullName(selectedArchetype));
    return scopeParts.length > 0 ? scopeParts.join(' · ') : null;
  }, [selectedCard, selectedSkeletonId, selectedArchetype, skeletons]);

  const detailedViewTitle = useMemo(() => {
    if (selectedCard) return `${selectedCard.name}${selectedCardScopeLabel ? ` in ${selectedCardScopeLabel}` : ''}`;
    if (selectedSkeletonId !== null) {
      const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
      const skIdx = skeletons.indexOf(sk!);
      return sk ? `Cluster ${skIdx + 1}` : 'Detailed View';
    }
    if (selectedArchetype) return archetypeFullName(selectedArchetype);
    return 'Detailed View';
  }, [selectedCard, selectedCardScopeLabel, selectedSkeletonId, selectedArchetype, skeletons]);

  const detailedViewSubtitle = useMemo(() => {
    const matchingPools = activeFilterPoolIndexSet?.size ?? displayRunData?.slimPools.length ?? 0;
    if (selectedCard) return `In ${selectedPools.length} draft pool${selectedPools.length !== 1 ? 's' : ''}`;
    if (selectedSkeletonId !== null || selectedArchetype) return `${matchingPools} matching draft pool${matchingPools !== 1 ? 's' : ''}`;
    return 'Choose a color profile, cluster, or card filter to narrow the detailed view.';
  }, [activeFilterPoolIndexSet, displayRunData, selectedCard, selectedPools.length, selectedSkeletonId, selectedArchetype]);

  const clearActiveFilter = useCallback(() => {
    setSelectedCardOracle(null);
    setSelectedArchetype(null);
    setSelectedSkeletonId(null);
  }, []);

  // Derived filter label for showing active filter in tables
  const cardStatsTitle = useMemo(() => {
    if (selectedCard) return 'Card Stats';
    if (selectedSkeletonId !== null) {
      const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
      const skIdx = skeletons.indexOf(sk!);
      return sk ? `Card Stats for Cluster ${skIdx + 1} Drafters` : 'All Card Stats';
    }
    if (selectedArchetype) return `Card Stats for ${archetypeFullName(selectedArchetype)} Drafters`;
    return 'All Card Stats';
  }, [selectedSkeletonId, selectedArchetype, selectedCard, skeletons]);

  return (
    <MainLayout>
      <DisplayContextProvider cubeID={cubeId}>
        <CubeLayout cube={cube} activeLink="draft-simulator">
          <Flexbox direction="col" gap="4" className="p-4">
            <DynamicFlash />

            {/* Controls */}
            <Card>
              <CardHeader><Text lg semibold>Draft Simulator</Text></CardHeader>
              <CardBody>
                <ul className="mb-4 text-sm text-text-secondary list-disc list-inside space-y-0.5">
                  <li>Simulates bot-only drafts to estimate pick rates, color trends, and archetype outcomes</li>
                  <li>Owners and collaborators can run simulations; results are visible to anyone who can view the cube</li>
                </ul>
                {lastRunTs && <div className="mb-3"><Text xs className="text-text-secondary">Last run: {new Date(lastRunTs).toLocaleString()}{cooldownActive && ` — next run available in ${hoursUntilNext}h`}</Text></div>}
                {canRun && (
                  <Row className="gap-4 flex-wrap items-end">
                    <Col xs={12} sm={4} md={2}><label className="block text-sm font-medium mb-1">Drafts</label><NumericInput min={1} max={100} value={numDrafts} onChange={setNumDrafts} disabled={isRunning} /></Col>
                    <Col xs={12} sm={4} md={2}><label className="block text-sm font-medium mb-1">Seats</label><NumericInput min={2} max={16} value={numSeats} onChange={setNumSeats} disabled={isRunning} /></Col>
                    <Col xs={12} sm={4} md={2}><label className="block text-sm font-medium mb-1">Dead Card Threshold (%)</label><NumericInput min={1} max={100} value={deadCardThresholdPct} onChange={setDeadCardThresholdPct} disabled={isRunning} /></Col>
                    <Col xs={12} sm={12} md={2}>
                      <button onClick={handleStart} disabled={isRunning || cooldownActive} className="w-full px-4 py-2 rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium">
                        {isRunning ? 'Simulating…' : cooldownActive ? `Available in ${hoursUntilNext}h` : 'Run Simulation'}
                      </button>
                    </Col>
                  </Row>
                )}
                {!canRun && (
                  <Text xs className="text-text-secondary">Only the cube owner and collaborators can start a new simulation from this page.</Text>
                )}
              </CardBody>
            </Card>

            {/* Progress */}
            {isRunning && (
              <Card><CardBody>
                <Flexbox direction="col" gap="2">
                  <Flexbox direction="row" justify="between">
                    <Text sm>{simulating ? 'Running draft simulation…' : deckBuildsLoading ? 'Building decks…' : 'Saving results…'}</Text>
                    {simulating && <Text sm className="text-text-secondary">{simProgress}%</Text>}
                  </Flexbox>
                  <div className="w-full bg-bg rounded-full h-2.5 overflow-hidden">
                    {simulating ? (
                      <div className="bg-green-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.max(2, simProgress)}%` }} />
                    ) : (
                      /* Indeterminate stripe animation for deckbuild / save phases */
                      <div className="h-2.5 rounded-full bg-green-600 animate-pulse" style={{ width: '100%', opacity: 0.7 }} />
                    )}
                  </div>
                </Flexbox>
              </CardBody></Card>
            )}

            {/* Error */}
            {status === 'failed' && errorMsg && <Card className="border-red-700"><CardBody><Text sm className="text-red-400">Error: {errorMsg}</Text></CardBody></Card>}
            {loadRunError && <Card className="border-red-700"><CardBody><Text sm className="text-red-400">Failed to load run: {loadRunError}</Text></CardBody></Card>}

            {/* Results */}
            {displayRunData && (
              <Flexbox direction="col" gap="6">
                <div className="simSection simSectionOverview flex flex-col gap-4">
                  <div className="simSectionHeading">
                    <Text semibold className="tracking-wide">Overview</Text>
                  </div>
                  <Flexbox direction="col" gap="4">
                    <Flexbox direction="row" gap="4" className="flex-wrap">
                      <SummaryCard label="Drafts Simulated" value={displayRunData.numDrafts} sub={`${displayRunData.numSeats} seats each`} />
                      <SummaryCard
                        label="Dead Cards"
                        value={displayRunData.deadCards.length}
                        sub={`< ${(displayRunData.deadCardThreshold * 100).toFixed(0)}% pick rate`}
                        onClick={() => { setCardStatsOpen(true); }}
                        badge={displayRunData.deadCards.length > 0 ? <span className="text-xs text-link">Click to view in card stats</span> : undefined}
                      />
                      {(() => {
                        const rates = [...displayRunData.cardStats].map((c) => c.pickRate).sort((a, b) => a - b);
                        const p10 = rates[Math.floor(rates.length * 0.10)] ?? 0;
                        const p90 = rates[Math.floor(rates.length * 0.90)] ?? 0;
                        const spread = p90 - p10;
                        const [badgeClass, badgeLabel] =
                          spread < 0.30 ? ['bg-green-900/40 text-green-300', 'Well balanced']
                          : spread < 0.55 ? ['bg-yellow-900/40 text-yellow-300', 'Some variance']
                          : ['bg-red-900/40 text-red-300', 'High variance'];
                        return (
                          <SummaryCard
                            label="Draft Balance"
                            value={`${(p10 * 100).toFixed(0)}%–${(p90 * 100).toFixed(0)}%`}
                            sub="pick rate range across the middle 80% of cards"
                            badge={<span className={`text-xs font-medium px-2 py-0.5 rounded ${badgeClass}`}>{badgeLabel}</span>}
                          />
                        );
                      })()}
                      <SummaryCard label="Cards Tracked" value={displayRunData.cardStats.length} sub="distinct oracle IDs seen" />
                    </Flexbox>
                  </Flexbox>
                </div>
                <div className="simSection simSectionArchetypes flex flex-col gap-5 pt-2">
                  <div className="simSectionHeading">
                    <Text semibold className="tracking-wide">Draft Patterns</Text>
                  </div>
                  <Row className="gap-4">
                    <Col xs={12}>
                      <Card>
                        <CardHeader>
                          <Flexbox direction="row" justify="between" alignItems="center">
                            <div>
                              <div><Text semibold>Deck Color Distribution</Text></div>
                              <div className="mt-0.5"><Text xs className="text-text-secondary">Click a row to filter stats by color profile</Text></div>
                            </div>
                            {selectedArchetype && (
                              <Flexbox direction="row" gap="2" alignItems="center">
                                <span className="text-xs bg-link/20 text-link border border-link/30 rounded px-2 py-0.5">{archetypeFullName(selectedArchetype)}</span>
                                <button type="button" className="text-xs text-text-secondary hover:text-text border border-border rounded px-2 py-0.5 hover:bg-bg-active" onClick={() => setSelectedArchetype(null)}>✕ Clear</button>
                              </Flexbox>
                            )}
                          </Flexbox>
                        </CardHeader>
                        <CardBody>
                          <ArchetypeChart
                            archetypeDistribution={displayedArchetypeDistribution}
                            selectedArchetype={selectedArchetype}
                            onSelect={(cp) => { setSelectedArchetype(cp); setSelectedSkeletonId(null); }}
                          />
                        </CardBody>
                      </Card>
                    </Col>
                  </Row>
                  {skeletons.length > 0 && (
                    <ArchetypeSkeletonSection
                      skeletons={skeletons}
                      k={clusterK}
                      onSetK={setClusterK}
                      coreThreshold={coreThreshold}
                      onSetCoreThreshold={setCoreThreshold}
                      onRecluster={() => {
                        setSelectedSkeletonId(null);
                        setClusterSeed((s) => s + 1);
                      }}
                      totalPools={displayRunData.slimPools.length}
                      selectedSkeletonId={selectedSkeletonId}
                      onSelectSkeleton={(id) => { setSelectedSkeletonId(id); setSelectedArchetype(null); }}
                      isOpen={archetypesOpen}
                      onToggle={() => setArchetypesOpen((o) => !o)}
                    />
                  )}
                </div>
                <div className="simSection simSectionCards flex flex-col gap-5 pt-2">
                  <div className="simSectionHeading">
                    <Text semibold className="tracking-wide">General Analysis</Text>
                  </div>
                  <Flexbox direction="col" gap="4">
                    <div className="simCardDiagBlock simCardDiagSummary flex flex-col gap-4">
                      <div className="simCardDiagBlock simCardDiagElo">
                        <Card><CardHeader><div><div><Text semibold>Elo vs. Pick Position</Text></div><div className="mt-0.5"><Text xs className="text-text-secondary">Each dot is a card. Higher on the chart means it is taken earlier on average.</Text></div></div></CardHeader><CardBody><EloVsPickRateScatter cardStats={displayRunData.cardStats} /></CardBody></Card>
                      </div>
                      <div className="simCardDiagBlock simCardDiagContext">
                        <DraftVsEloTable cardStats={displayRunData.cardStats} />
                      </div>
                    </div>
                    <div ref={detailedViewRef} className="simCardDiagBlock simCardDiagDetailArea flex flex-col gap-5 pt-2">
                      <div className="simSectionHeading">
                        <Text semibold className="tracking-wide">Detailed View</Text>
                      </div>
                      {/* Top summary row — no harsh inner borders, flat surfaces */}
                      <div className="flex flex-col md:flex-row gap-3 items-stretch">
                        {/* Left: selected card / default state */}
                        <div className="flex-1 min-w-0 rounded-lg bg-bg-accent/40 px-4 py-3">
                          {selectedCard ? (
                            <Flexbox direction="row" gap="3" alignItems="start" className="min-w-0">
                              {displayRunData.cardMeta[selectedCard.oracle_id]?.imageUrl && (
                                <img
                                  src={displayRunData.cardMeta[selectedCard.oracle_id]?.imageUrl}
                                  alt={selectedCard.name}
                                  className="w-20 rounded border border-border/40 flex-shrink-0 shadow-sm"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <Text semibold className="text-lg leading-snug">{detailedViewTitle}</Text>
                                <div className="mt-0.5"><Text xs className="text-text-secondary/60">{detailedViewSubtitle}</Text></div>
                                <Flexbox direction="row" gap="4" alignItems="center" className="flex-wrap mt-2">
                                  {(() => {
                                    // When a filter is active, use only filtered stats (null → card not seen in scope)
                                    const statsForScope = activeFilterPoolIndexSet ? selectedCardStats : (selectedCardStats ?? selectedCard);
                                    return (
                                      <>
                                        <span className="text-xs text-text-secondary/50 font-medium">Pick rate <span className="text-text-secondary/80">{statsForScope ? `${(statsForScope.pickRate * 100).toFixed(1)}%` : '0%'}</span></span>
                                        <span className="text-xs text-text-secondary/50 font-medium">Avg position <span className="text-text-secondary/80">{statsForScope && statsForScope.avgPickPosition > 0 ? statsForScope.avgPickPosition.toFixed(1) : '—'}</span></span>
                                      </>
                                    );
                                  })()}
                                </Flexbox>
                              </div>
                            </Flexbox>
                          ) : (
                            <div>
                              <Text semibold className="text-lg leading-snug">{detailedViewTitle}</Text>
                              <div className="mt-0.5"><Text xs className="text-text-secondary/60">{detailedViewSubtitle}</Text></div>
                            </div>
                          )}
                        </div>
                        {/* Right: scope panel — only when filters active */}
                        {activeFilterChips.length > 0 && (
                          <div className="md:w-56 flex-shrink-0 rounded-lg bg-bg-accent/25 px-4 py-3">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className="text-xs font-medium text-text-secondary/60 uppercase tracking-wider">Scope</span>
                              <button type="button" className="text-xs text-text-secondary/60 hover:text-text-secondary" onClick={clearActiveFilter}>Clear</button>
                            </div>
                            <Flexbox direction="row" gap="1" alignItems="center" className="flex-wrap gap-1.5">
                              {detailedViewScopeChips.map((chip) => (
                                <span key={chip} className="text-xs bg-bg-accent text-text-secondary/80 rounded px-2 py-0.5">{chip}</span>
                              ))}
                            </Flexbox>
                          </div>
                        )}
                      </div>
                      {/* Zero-intersection warning */}
                      {activeFilterPoolIndexSet !== null && activeFilterPoolIndexSet.size === 0 && (
                        <div className="rounded-lg border border-yellow-700 bg-yellow-900/20 px-4 py-3 flex items-center justify-between gap-3">
                          <Text sm className="text-yellow-300">No draft pools match the current combination of filters.</Text>
                          <button type="button" className="text-xs text-yellow-300 border border-yellow-700 rounded px-2 py-0.5 hover:bg-yellow-900/40 flex-shrink-0" onClick={clearActiveFilter}>Clear filters</button>
                        </div>
                      )}
                      {hasApproximateFilteredStats && (
                        <div className="rounded-lg border border-yellow-800/80 bg-yellow-900/15 px-4 py-3">
                          <Text sm className="text-yellow-200">This saved run does not include the full setup data needed for exact scoped card stats. Matching decks and draft breakdowns are filtered correctly, but some card-stat values may still reflect the full run.</Text>
                        </div>
                      )}
                      {/* Cluster card preview — shown whenever a cluster is selected */}
                      {selectedSkeletonId !== null && (() => {
                        const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
                        if (!sk || (sk.coreCards.length === 0 && sk.occasionalCards.length === 0)) return null;
                        return (
                          <div className="rounded-lg bg-bg-accent/30 border border-border/50 px-4 py-3">
                            <Text xs className="text-text-secondary font-semibold uppercase tracking-[0.14em] mb-2.5">Cluster defining cards</Text>
                            <div className="overflow-x-auto">
                              <div className="flex flex-row gap-2 pb-1" style={{ minWidth: 'max-content' }}>
                                {sk.coreCards.map((card) => (
                                  <SkeletonCardImage key={card.oracle_id} card={card} size={90} />
                                ))}
                                {sk.occasionalCards.length > 0 && (
                                  <>
                                    <div className="w-px bg-border/60 self-stretch mx-1 flex-shrink-0" />
                                    {sk.occasionalCards.map((card) => (
                                      <div key={card.oracle_id} className="opacity-60">
                                        <SkeletonCardImage card={card} size={72} />
                                      </div>
                                    ))}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      {/* Mini chart row — lighter surface than the stats table below */}
                      <Row className="gap-3">
                        <Col xs={12} md={6}><Card className="border-border/50 bg-bg-accent/30"><CardHeader><div><div><Text semibold>Deck Color Share</Text></div><div className="mt-0.5"><Text xs className="text-text-secondary">Each maindeck card contributes to its colors. Multicolor cards split evenly.{activeFilterPoolIndexSet ? ' Filtered to current scope.' : ''}</Text></div></div></CardHeader><CardBody><DeckColorShareChart deckBuilds={filteredDecks} cardMeta={displayRunData.cardMeta} /></CardBody></Card></Col>
                        <Col xs={12} md={6}><Card className="border-border/50 bg-bg-accent/30"><CardHeader><div><div><Text semibold>Mana Curve Share</Text></div><div className="mt-0.5"><Text xs className="text-text-secondary">Share of nonland maindeck cards by mana value.{activeFilterPoolIndexSet ? ' Filtered to current scope.' : ''}</Text></div></div></CardHeader><CardBody><ManaCurveShareChart deckBuilds={filteredDecks} cardMeta={displayRunData.cardMeta} /></CardBody></Card></Col>
                      </Row>
                      <div className="simCardDiagBlock simCardDiagTable flex flex-col gap-5">
                      <Card className="border-border">
                        <CardHeader>
                          <Flexbox direction="row" justify="between" alignItems="center">
                            <div>
                              <Flexbox direction="row" gap="2" alignItems="center">
                                <Text semibold>{cardStatsTitle}</Text>
                              </Flexbox>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCardStatsOpen((o) => !o)}
                              className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active"
                            >
                              {cardStatsOpen ? '▲ Hide' : '▼ Show'}
                            </button>
                          </Flexbox>
                        </CardHeader>
                        <Collapse isOpen={cardStatsOpen}>
                          <CardBody>
                            <CardStatsTable cardStats={visibleCardStats} deadCardThreshold={displayRunData.deadCardThreshold} onSelectCard={setSelectedCardOracle} selectedCardOracle={selectedCardOracle} inDeckOracles={inDeckOracles} inSideboardOracles={inSideboardOracles} deckInclusionPct={deckInclusionPct} visiblePoolCounts={visiblePoolCounts} onPageChange={() => detailedViewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
                          </CardBody>
                        </Collapse>
                      </Card>
                      {selectedCard && (
                        <div ref={poolViewRef} className="simCardDiagBlock simCardDiagDetail pt-2 border-t border-border">
                          <CardPoolView card={selectedCard} pools={selectedPools} deckBuilds={activeDecks} deckLoading={deckBuildsLoading} cardMeta={displayRunData.cardMeta} onClose={() => setSelectedCardOracle(null)} />
                        </div>
                      )}
                      </div>
                      {(selectedSkeletonId !== null || selectedArchetype) && !selectedCard && (
                        <div ref={poolViewRef}>
                          {selectedSkeletonId !== null && !selectedArchetype && (() => {
                            const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
                            const skIdx = skeletons.indexOf(sk!);
                            return sk ? <ArchetypePoolList archetype={sk.colorProfile} title={`Cluster ${skIdx + 1}`} pools={sk.poolIndices.map((i) => displayedPools[i]).filter((p): p is SimulatedPool => !!p)} deckBuilds={activeDecks} deckLoading={deckBuildsLoading} cardMeta={displayRunData.cardMeta} onClose={() => setSelectedSkeletonId(null)} /> : null;
                          })()}
                          {selectedArchetype && !selectedSkeletonId && (
                            <ArchetypePoolList archetype={selectedArchetype} title={activeFilterSummary ?? archetypeFullName(selectedArchetype)} pools={displayedPools.filter((p) => !activeFilterPoolIndexSet || activeFilterPoolIndexSet.has(p.poolIndex))} deckBuilds={activeDecks} deckLoading={deckBuildsLoading} cardMeta={displayRunData.cardMeta} onClose={() => setSelectedArchetype(null)} />
                          )}
                        </div>
                      )}
                    </div>
                  </Flexbox>
                </div>
                <Text xs className="text-text-secondary text-right">Generated {new Date(displayRunData.generatedAt).toLocaleString()}</Text>
              </Flexbox>
            )}

            <div className="simSection simSectionReference flex flex-col gap-4 pt-3 border-t border-border">
              <div className="simSectionHeading simSectionHeadingSubtle">
                <Text semibold className="tracking-wide text-text-secondary">Reference</Text>
              </div>
              <Flexbox direction="col" gap="4">
                {/* Run history */}
                {runs.length > 0 && (
                  <Card>
                    <CardHeader><Text semibold>Simulation History</Text></CardHeader>
                    <CardBody>
                      <div className="overflow-x-auto rounded border border-border bg-bg">
                        <table className="min-w-full divide-y divide-border text-sm">
                          <thead className="bg-bg-accent">
                            <tr>
                              {['Date', 'Drafts', ''].map((h) => (
                                <th key={h} className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {runs.map((run) => (
                              <tr
                                key={run.ts}
                                onClick={() => handleLoadRun(run.ts)}
                                className={[
                                  'cursor-pointer',
                                  run.ts === selectedTs ? 'bg-bg-active font-semibold border-l-2 border-link' : 'hover:bg-bg-active border-l-2 border-transparent',
                                ].join(' ')}
                              >
                            <td className="px-3 py-2">{new Date(run.generatedAt).toLocaleString()}</td>
                            <td className="px-3 py-2 text-text-secondary">{run.numDrafts} × {run.numSeats} seats</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRunPendingDelete(run);
                                  setDeleteRunModalOpen(true);
                                }}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                          </tbody>
                        </table>
                      </div>
                      {loadingRun && <Text xs className="text-text-secondary mt-2">Loading run…</Text>}
                    </CardBody>
                  </Card>
                )}
                <SimulatorExplainer />
              </Flexbox>
            </div>
            <PriorRunDeleteModal isOpen={deleteRunModalOpen} setOpen={setDeleteRunModalOpen} run={runPendingDelete} onConfirm={handleDeleteRun} />
          </Flexbox>
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

// ---------------------------------------------------------------------------
// Explainer / FAQ
// ---------------------------------------------------------------------------

const FAQ_ITEMS: { q: string; answer: React.ReactNode }[] = [
  {
    q: 'How does drafting work?',
    answer: (
      <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
        <p>
          The simulator runs N complete drafts with M bot seats each. At every pick, CubeCobra's ML draft
          model evaluates the current pack alongside each bot's accumulated pool and selects the card it
          scores highest. Packs rotate after each pick — left for pack 1, right for pack 2 — just like a
          real draft. Once all packs are exhausted, each seat's picks form a pool.
        </p>
        <p>
          Each bot uses a machine learning model trained on hundreds of thousands of real human draft picks.
          At each pick, the bot encodes its current pool into a 128-dimensional embedding vector that
          represents the archetype and strategy it has been drafting toward. The draft decoder then scores
          every card in the pack based on how well it fits that embedding, and the bot selects the
          highest-rated card. Because the model learned directly from human draft data, it naturally
          prioritizes synergy and deck cohesion over raw individual card power.
        </p>
        <p>The simulation tracks pick rate, average pick position within the pack, wheel count (drafted after the pack has gone all the way around the table), and P1P1 frequency per card.</p>
      </div>
    ),
  },
  {
    q: 'How does archetype clustering work?',
    answer: (
      <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
        <p>
          After deckbuilding, each built deck is grouped with other similar decks to surface recurring deck families.
          This is an approximate similarity-based view, not a claim that every deck belongs cleanly to a single archetype.
          Clustering on mainboards instead of full pools keeps the focus on cards that actually made the final deck,
          rather than sideboard picks. Three steps build the vectors used for comparison:
        </p>
        <ol className="list-decimal list-inside space-y-1.5 ml-2">
          <li><span className="font-medium text-text">Binary presence</span> — each mainboard becomes a vector of 1s (in the deck) and 0s (not in the deck), one dimension per card.</li>
          <li>
            <span className="font-medium text-text">TF-IDF weighting</span> — cards that show up in nearly every deck get low weight,
            while cards that help distinguish one deck family from another get higher weight. Formally:{' '}
            <code className="text-xs bg-bg-accent px-1 py-0.5 rounded">weight = log((N+1) / (poolsContainingCard+1))</code>.
            This stops universal staples from dominating the grouping.
          </li>
          <li><span className="font-medium text-text">L2 normalisation</span> — each vector is scaled to unit length so clustering is driven more by card composition than raw vector magnitude.</li>
        </ol>
        <p>
          K-means++ then assigns decks to K clusters. Raising K splits broad families into narrower ones; lowering K merges
          similar families together. Re-cluster reruns the same process with a different random seed, which is useful when a
          few decks sit near the boundary between groups.
        </p>
        <p>Each cluster shows:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li><span className="font-medium text-text">Core cards</span> — cards found in at least Core% of decks in the cluster</li>
          <li><span className="font-medium text-text">Support cards</span> — cards found in roughly half Core% up to Core% of decks in the cluster</li>
          <li>
            <span className="font-medium text-text">Lock pairs</span> — card pairs that appear together much more often than their individual rates would predict
            (&gt;60% co-occurrence and &gt;5% above the independence baseline). These often signal tight synergies or linear plans.
          </li>
        </ul>
      </div>
    ),
  },
  {
    q: 'How does deckbuilding work?',
    answer: (
      <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
        <p>
          After simulation finishes, every pool is run through the same automated deckbuilder used at the
          end of a real CubeCobra draft — the exact same logic as bot seats in live play.
        </p>
        <p>The process has three phases:</p>
        <ol className="list-decimal list-inside space-y-1.5 ml-2">
          <li>
            <span className="font-medium text-text">Seed selection</span> — a batch ML call scores roughly 10 "seed" cards from the pool
            that best define the deck's strategic direction. These anchor the build.
          </li>
          <li>
            <span className="font-medium text-text">Iterative filling</span> — the draft model fills remaining spell slots one at a time,
            using the seeded picks as context to maintain strategic coherence up to the configured spell count (default 23).
          </li>
          <li>
            <span className="font-medium text-text">Land fill</span> — basic lands from the cube's basics board are added to reach the
            configured land count (default 17). Color ratios follow the mainboard's mana requirements.
          </li>
        </ol>
        <p>
          The <span className="font-medium text-text">Deck %</span> column in All Card Stats shows what fraction of builds that included
          a card in the pool chose to mainboard it — near 100% means it's an auto-include whenever drafted;
          low values indicate it frequently gets relegated to the sideboard.
        </p>
      </div>
    ),
  },
];

const SimulatorExplainer: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <Card>
      <CardHeader>
        <Text semibold>How It Works</Text>
      </CardHeader>
      <CardBody className="p-0">
        {FAQ_ITEMS.map((item, idx) => (
          <div key={idx} className={idx < FAQ_ITEMS.length - 1 ? 'border-b border-border' : ''}>
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bg-active"
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
            >
              <Text sm semibold>{item.q}</Text>
              <span className="text-text-secondary text-sm ml-4 flex-shrink-0">{openIdx === idx ? '▲' : '▼'}</span>
            </button>
            <Collapse isOpen={openIdx === idx}>
              <div className="px-4 pb-4">
                {item.answer}
              </div>
            </Collapse>
          </div>
        ))}
      </CardBody>
    </Card>
  );
};

export default RenderToRoot(CubeDraftSimulatorPage);
