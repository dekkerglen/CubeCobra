/* eslint-disable camelcase, no-plusplus, no-restricted-syntax */
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { isManaFixingLand } from '@utils/cardutil';
import type { CardDetails } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import {
  ArchetypeEntry,
  ArchetypeSkeleton,
  BuiltDeck,
  CardMeta,
  CardStats,
  SimulatedPool,
  SimulationReport,
  SimulationRunData,
  SimulationRunEntry,
  SimulationSetupResponse,
  SlimPool,
} from '@utils/datatypes/SimulationReport';
import { getCubeId } from '@utils/Util';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  PointElement,
  ScatterController,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

import Button from '../components/base/Button';
import { Card, CardBody, CardHeader } from '../components/base/Card';
import Collapse from '../components/base/Collapse';
import Input from '../components/base/Input';
import { Col, Flexbox, Row } from '../components/base/Layout';
import Link from '../components/base/Link';
import Select from '../components/base/Select';
import Text from '../components/base/Text';
import DraftSimulatorFilterBar, { type FilterChipItem } from '../components/draftSimulator/DraftSimulatorFilterBar';
import { type DraftMapColorMode, type DraftMapPoint } from '../components/draftSimulator/DraftMapScatter';
import {
  ClearSimulationHistoryModal,
  LeaveSimulationModal,
  PriorRunDeleteModal,
} from '../components/draftSimulator/DraftSimulatorModals';
import { PoolInspectionModal } from '../components/draftSimulator/PoolExpansionContent';
import DraftBreakdownTable, { buildDraftBreakdownRowSummary } from '../components/draftSimulator/DraftBreakdownTable';
import ArchetypeSkeletonSection from '../components/draftSimulator/ArchetypeSkeletonSection';
import ClusterDetailPanel from '../components/draftSimulator/ClusterDetailPanel';
import ColorProfileDetailPanel from '../components/draftSimulator/ColorProfileDetailPanel';
import DraftMapCard, { computeDraftMapPoints, DraftMapScopePanel } from '../components/draftSimulator/DraftMapCard';
import DraftSimulatorBottomSection from '../components/draftSimulator/DraftSimulatorBottomSection';
import {
  DraftSimulatorDesktopView,
  DraftSimulatorMobileView,
  DraftSimulatorOverviewSection,
} from '../components/draftSimulator/DraftSimulatorResultsViews';
import DynamicFlash from '../components/DynamicFlash';
import RenderToRoot from '../components/RenderToRoot';
import withAutocard from '../components/WithAutocard';
import { CSRFContext } from '../contexts/CSRFContext';
import { DisplayContextProvider } from '../contexts/DisplayContext';
import useClusteringPipeline from '../hooks/useClusteringPipeline';
import useDraftSimulatorFocus from '../hooks/useDraftSimulatorFocus';
import useDraftSimulatorPresentation from '../hooks/useDraftSimulatorPresentation';
import useDraftSimulatorSelection from '../hooks/useDraftSimulatorSelection';
import type {
  DraftSimulatorBottomTab,
  DraftSimulatorDerivedData,
  DraftSimulatorSelectionSetters,
  DraftSimulatorSelectionState,
} from '../hooks/draftSimulatorHookTypes';
import useLocalSimulationHistory from '../hooks/useLocalSimulationHistory';
import useSimulationRun from '../hooks/useSimulationRun';
import CubeLayout from '../layouts/CubeLayout';
import MainLayout from '../layouts/MainLayout';
import {
  buildOracleRemapping,
  DeckbuildEntry,
  loadDraftRecommender,
  localBatchDeckbuild,
  localPickBatch,
  localRecommend,
  WebGLInferenceError,
} from '../utils/draftBot';
import { buildClusterRecommendationInput } from '../utils/draftSimulatorClustering';
import { prefetchClientSimulationResources } from '../utils/draftSimulatorSetup';
import {
  archetypeFullName,
  computeClusterThemes,
  formatClusterThemeLabels,
  getPoolMainCards,
  inferDraftThemes,
} from '../utils/draftSimulatorThemes';
import { computeFilteredCardStats } from '../utils/draftSimulatorStats';
import { OTAG_BUCKET_MAP } from '../utils/otagBucketMap';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, PointElement, ScatterController, Tooltip, Legend);

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

const AutocardLink = withAutocard(Link);

function autocardDetails(oracleId: string, name: string, imageUrl?: string): Partial<CardDetails> {
  const idUrl = encodeURIComponent(oracleId);
  return {
    oracle_id: oracleId,
    scryfall_id: oracleId,
    name,
    full_name: name,
    image_normal: imageUrl || `/tool/cardimage/${idUrl}`,
  };
}

const renderAutocardNameLink = (oracleId: string, name: string, imageUrl?: string) => {
  const idUrl = encodeURIComponent(oracleId);
  return (
    <AutocardLink
      href={`/tool/card/${idUrl}`}
      className="text-inherit hover:text-link hover:underline"
      card={{ details: autocardDetails(oracleId, name, imageUrl) } as any}
    >
      {name}
    </AutocardLink>
  );
};

const SIM_PREVIEW_CARD_W = 140;

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)} s`;
}

function useIsMobileLayout(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < breakpoint : false));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, [breakpoint]);

  return isMobile;
}

/** Number input that lets the user type freely; commits/clamps only on blur or Enter. */
const NumericInput: React.FC<{
  value: number;
  min: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  className?: string;
}> = ({ value, min, max, step, onChange, disabled, className }) => {
  const [draft, setDraft] = useState(String(value));
  const isFloat = step !== undefined && step % 1 !== 0;
  // Keep draft in sync when the parent value changes externally
  const prevValueRef = useRef(value);
  useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      setDraft(String(value));
    }
  }, [value]);

  const commit = () => {
    const parsed = isFloat ? parseFloat(draft) : parseInt(draft, 10);
    const clamped = isNaN(parsed) ? value : Math.max(min, max !== undefined ? Math.min(max, parsed) : parsed);
    prevValueRef.current = clamped;
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  };

  return (
    <Input
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      disabled={disabled}
      className={className}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const nextDraft = e.target.value;
        setDraft(nextDraft);
        const parsed = isFloat ? parseFloat(nextDraft) : parseInt(nextDraft, 10);
        if (!isNaN(parsed) && parsed >= min && (max === undefined || parsed <= max)) {
          prevValueRef.current = parsed;
          if (parsed !== value) onChange(parsed);
        }
      }}
      onBlur={commit}
      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
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

function getColorProfileCodes(colorPair: string): string[] {
  const letters = colorPair.split('').filter((c) => c in MTG_COLORS && c !== 'C' && c !== 'M');
  return letters.length === 0 ? ['C'] : letters;
}

/** Sorts a color profile string into canonical WUBRG order (e.g. "BGU" → "UBG"). */
function normalizeColorOrder(profile: string): string {
  if (!profile || profile === 'C') return 'C';
  const sorted = profile.split('').filter((c) => COLOR_KEYS.includes(c as any)).sort((a, b) => COLOR_KEYS.indexOf(a as any) - COLOR_KEYS.indexOf(b as any));
  return sorted.length > 0 ? sorted.join('') : 'C';
}

/** Recomputes a skeleton's color profile from actual mainboard deck builds (WUBRG order).
 *  Uses a relative threshold: a color must reach ≥33% of the dominant color's share
 *  to be considered a "main" color. This handles both pure 2-color decks and genuine
 *  5-color decks while filtering out light splashes in multicolor formats. */
function computeSkeletonColorProfile(
  skeleton: ArchetypeSkeleton,
  deckBuilds: BuiltDeck[] | null | undefined,
  cardMeta: Record<string, CardMeta>,
): string {
  if (!deckBuilds) return skeleton.colorProfile;
  const shares: Record<string, number> = Object.fromEntries(COLOR_KEYS.map((k) => [k, 0]));
  for (const poolIndex of skeleton.poolIndices) {
    const deck = deckBuilds[poolIndex];
    if (!deck) continue;
    for (const oracle of deck.mainboard) {
      const colors = getDeckShareColors(oracle, cardMeta).filter((c) => c !== 'C');
      if (colors.length === 0) continue;
      const share = 1 / colors.length;
      for (const c of colors) shares[c] = (shares[c] ?? 0) + share;
    }
  }
  const total = COLOR_KEYS.reduce((s, k) => s + (shares[k] ?? 0), 0);
  if (total === 0) return 'C';
  const maxShare = Math.max(...COLOR_KEYS.map((k) => shares[k] ?? 0));
  const significant = COLOR_KEYS.filter((k) => (shares[k] ?? 0) >= maxShare * 0.33);
  return significant.length > 0 ? significant.join('') : 'C';
}

function getSkeletonDisplayName(
  skeleton: ArchetypeSkeleton,
  poolArchetypeLabels: Map<number, string> | null | undefined,
  skeletonColorProfiles?: Map<number, string>,
): string {
  const colorProfile = skeletonColorProfiles?.get(skeleton.clusterId) ?? normalizeColorOrder(skeleton.colorProfile);
  if (poolArchetypeLabels) {
    const counts = new Map<string, number>();
    for (const pi of skeleton.poolIndices) {
      const label = poolArchetypeLabels.get(pi);
      if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (dominant) {
      const colorPart = colorProfile && colorProfile !== 'C' ? `${colorProfile} ` : '';
      return `${colorPart}${dominant[0]}`;
    }
  }
  return archetypeFullName(colorProfile);
}

function getColorProfileGradient(colorPair: string): string {
  const colors = getColorProfileCodes(colorPair).map((code) => MTG_COLORS[code]?.bg ?? MTG_COLORS.C!.bg);
  if (colors.length === 1) return colors[0]!;
  return `linear-gradient(90deg, ${colors.map((color, index) => `${color} ${(index / (colors.length - 1)) * 100}%`).join(', ')})`;
}

// Number of lock-pair candidates to check in the filter preview (O(k²) so keep small)
const LOCK_CANDIDATE_LIMIT = 12;
const GPU_BATCH_OPTIONS = [
  { value: '4', label: '4 - mobile (iPhone)' },
  { value: '8', label: '8 - mobile (high-end)' },
  { value: '16', label: '16 - conservative' },
  { value: '32', label: '32 - safe' },
  { value: '64', label: '64 - balanced' },
  { value: '128', label: '128 - strong GPU' },
];
function nextLowerGpuBatchSize(batchSize: number): number | null {
  const lowerOptions = GPU_BATCH_OPTIONS.map((option) => parseInt(option.value, 10))
    .filter((value) => value < batchSize)
    .sort((a, b) => b - a);
  return lowerOptions[0] ?? null;
}

function randomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}

/**
 * Assess deck/pool colors using the same logic as the server-side assessColors:
 * iterate over cards, exclude lands, count color identity occurrences, and
 * include a color if it appears on >10% of non-land cards.
 */
function assessDeckColors(cards: string[], cardMeta: Record<string, CardMeta>): string {
  const colorCounts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  let count = 0;
  for (const oracle of cards) {
    const meta = cardMeta[oracle];
    if (!meta) continue;
    if ((meta.type ?? '').toLowerCase().includes('land')) continue;
    count++;
    for (const c of meta.colorIdentity) {
      if (c in colorCounts) colorCounts[c] = (colorCounts[c] ?? 0) + 1;
    }
  }
  if (count === 0) return 'C';
  const colors = Object.keys(colorCounts)
    .filter((c) => (colorCounts[c] ?? 0) / count > 0.1)
    .sort();
  return colors.length === 0 ? 'C' : colors.join('');
}

/** Pre-deckbuild: assess pool colors from all picks (same threshold logic). */
function assessPoolColors(picks: string[], cardMeta: Record<string, CardMeta>): string {
  return assessDeckColors(picks, cardMeta);
}

function reconstructSimulatedPools(slimPools: SlimPool[], cardMeta: Record<string, CardMeta>): SimulatedPool[] {
  return slimPools.map((slim, poolIndex) => ({
    poolIndex,
    draftIndex: slim.draftIndex,
    seatIndex: slim.seatIndex,
    archetype: slim.archetype,
    picks: slim.picks.map((p) => {
      const meta = cardMeta[p.oracle_id];
      return {
        oracle_id: p.oracle_id,
        name: meta?.name ?? p.oracle_id,
        imageUrl: meta?.imageUrl ?? '',
        packNumber: p.packNumber,
        pickNumber: p.pickNumber,
      };
    }),
  }));
}

async function runClientSimulation(
  setup: SimulationSetupResponse,
  numDrafts: number,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
  gpuBatchSize?: number,
): Promise<SimulationReport> {
  const { initialPacks, packSteps, cardMeta, cubeName, numSeats } = setup;
  const oracleRemapping = buildOracleRemapping(cardMeta);
  const statsMap = new Map<string, RawStats>();
  const archetypeCounts = new Map<string, number>();

  const getStats = (oracle: string): RawStats => {
    let s = statsMap.get(oracle);
    if (!s) {
      const meta = cardMeta[oracle];
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

  // Count total pick rounds for progress reporting
  let totalPicks = 0;
  for (const steps of packSteps) {
    for (const step of steps) {
      if (step.action === 'pick' || step.action === 'pickrandom') totalPicks += step.amount ?? 1;
    }
  }
  totalPicks = Math.max(1, totalPicks);
  let donePicks = 0;

  const numPacks = packSteps.length;
  const allCurrentPacks: string[][][] = Array.from({ length: numDrafts }, (_, d) =>
    Array.from({ length: numSeats }, (_, s) => [...(initialPacks[d]?.[s]?.[0] ?? [])]),
  );
  const allPools: string[][][] = Array.from({ length: numDrafts }, () => Array.from({ length: numSeats }, () => []));
  const allPickMeta: { packNumber: number; pickNumber: number }[][][] = Array.from({ length: numDrafts }, () =>
    Array.from({ length: numSeats }, () => []),
  );
  const randomTrashByPool: string[][] = Array.from({ length: numDrafts * numSeats }, () => []);

  onProgress(0);

  for (let packNum = 0; packNum < numPacks; packNum++) {
    signal?.throwIfAborted();
    if (packNum > 0) {
      for (let d = 0; d < numDrafts; d++)
        for (let s = 0; s < numSeats; s++) allCurrentPacks[d]![s] = [...(initialPacks[d]?.[s]?.[packNum] ?? [])];
    }

    const steps = packSteps[packNum] ?? [];
    let pickNumInPack = 1;

    for (const step of steps) {
      if (step.action === 'pick' || step.action === 'pickrandom') {
        const numPicksThisStep = step.amount ?? 1;
        for (let p = 0; p < numPicksThisStep; p++) {
          signal?.throwIfAborted();
          // Track timesSeen (and p1p1Seen at P1P1) for all cards currently visible
          const isP1P1 = packNum === 0 && pickNumInPack === 1;
          for (let d = 0; d < numDrafts; d++)
            for (let s = 0; s < numSeats; s++)
              for (const oracle of allCurrentPacks[d]![s]!) {
                const st = getStats(oracle);
                st.timesSeen++;
                if (isP1P1) st.p1p1Seen++;
              }

          let picks: string[];

          if (step.action === 'pick') {
            const flatPacks = allCurrentPacks.flatMap((draftPacks) => draftPacks);
            const flatPools = allPools.flatMap((draftPools) => draftPools);
            const expectedPicks = numDrafts * numSeats;

            // Local TF.js inference — no server round-trip
            picks = await localPickBatch(flatPacks, flatPools, oracleRemapping, gpuBatchSize);
            if (!Array.isArray(picks) || picks.length !== expectedPicks) {
              throw new Error(`Local draft bot returned ${picks?.length ?? 0} picks, expected ${expectedPicks}`);
            }
          } else {
            // pickrandom — choose a random card from each pack, no ML call needed
            picks = allCurrentPacks.flatMap((draftPacks) =>
              draftPacks.map((pack) => (pack.length > 0 ? (pack[randomIndex(pack.length)] ?? '') : '')),
            );
          }

          let idx = 0;
          for (let d = 0; d < numDrafts; d++)
            for (let s = 0; s < numSeats; s++) {
              const oracle = picks[idx++] ?? '';
              const pack = allCurrentPacks[d]![s]!;
              if (pack.length === 0) continue; // empty pack — skip without recording a pick
              const removeIdx = pack.indexOf(oracle);
              if (removeIdx >= 0) pack.splice(removeIdx, 1);
              allPools[d]![s]!.push(oracle);
              allPickMeta[d]![s]!.push({ packNumber: packNum, pickNumber: pickNumInPack });
              if (oracle) {
                const entry = getStats(oracle);
                entry.timesPicked++;
                entry.pickPositionSum += pickNumInPack;
                entry.pickPositionCount++;
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
          signal?.throwIfAborted();
          for (let d = 0; d < numDrafts; d++)
            for (let s = 0; s < numSeats; s++) {
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
  for (let d = 0; d < numDrafts; d++)
    for (let s = 0; s < numSeats; s++) {
      const picks = allPools[d]![s]!;
      const metas = allPickMeta[d]![s]!;
      const archetype = assessPoolColors(picks, cardMeta);
      archetypeCounts.set(archetype, (archetypeCounts.get(archetype) ?? 0) + 1);
      const poolIndex = slimPools.length;
      slimPools.push({
        draftIndex: d,
        seatIndex: s,
        archetype,
        picks: picks.map((oracle_id, k) => ({
          oracle_id,
          packNumber: metas[k]?.packNumber ?? 0,
          pickNumber: metas[k]?.pickNumber ?? 1,
        })),
      });
      for (const oracle of picks) if (oracle) statsMap.get(oracle)?.poolIndices.push(poolIndex);
    }

  const cardStats: CardStats[] = [];
  for (const [oracle_id, raw] of statsMap.entries()) {
    cardStats.push({
      oracle_id,
      name: raw.name,
      colorIdentity: raw.colorIdentity,
      elo: raw.elo,
      timesSeen: raw.timesSeen,
      timesPicked: raw.timesPicked,
      pickRate: raw.timesSeen > 0 ? raw.timesPicked / raw.timesSeen : 0,
      avgPickPosition: raw.pickPositionCount > 0 ? raw.pickPositionSum / raw.pickPositionCount : 0,
      wheelCount: raw.wheelCount,
      p1p1Count: raw.p1p1Count,
      p1p1Seen: raw.p1p1Seen,
      poolIndices: raw.poolIndices,
    });
  }
  cardStats.sort((a, b) => a.avgPickPosition - b.avgPickPosition);

  const rates = cardStats.map((c) => c.pickRate);
  const mean = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  const variance = rates.length > 1 ? rates.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (rates.length - 1) : 0;
  const totalSeats = numDrafts * numSeats;
  const archetypeDistribution: ArchetypeEntry[] = [...archetypeCounts.entries()]
    .map(([colorPair, count]) => ({ colorPair, count, percentage: count / totalSeats }))
    .sort((a, b) => b.count - a.count);
  const simulatedPools = reconstructSimulatedPools(slimPools, cardMeta);

  return {
    cubeId: setup.cubeId,
    cubeName,
    numDrafts,
    numSeats,
    cardStats,
    archetypeDistribution,
    convergenceScore: Math.sqrt(variance),
    generatedAt: new Date().toISOString(),
    cardMeta,
    slimPools,
    simulatedPools,
    setupData: { initialPacks, packSteps, numSeats },
  };
}

const COLOR_KEYS = ['W', 'U', 'B', 'R', 'G'] as const;
const COLOR_KEYS_WITH_C = [...COLOR_KEYS, 'C'] as const;

function getDeckShareColors(oracle: string, cardMeta: Record<string, CardMeta>): string[] {
  const meta = cardMeta[oracle];
  if ((meta?.type ?? '').toLowerCase().includes('land')) return [];
  const identity = (meta?.colorIdentity ?? []).filter((color) => MTG_COLORS[color] && color !== 'C');
  return identity.length > 0 ? identity : ['C'];
}

const RowColorShare: React.FC<{ deck: BuiltDeck | null; cardMeta: Record<string, CardMeta> }> = ({ deck, cardMeta }) => {
  if (!deck || deck.mainboard.length === 0) return null;
  const shares: Record<string, number> = Object.fromEntries(COLOR_KEYS_WITH_C.map((k) => [k, 0]));
  for (const oracle of deck.mainboard) {
    const colors = getDeckShareColors(oracle, cardMeta);
    if (colors.length === 0) continue;
    const share = 1 / colors.length;
    for (const c of colors) shares[c] = (shares[c] ?? 0) + share;
  }
  const total = Object.values(shares).reduce((s, v) => s + v, 0);
  if (total === 0) return null;
  const segments = COLOR_KEYS_WITH_C.map((k) => ({ key: k, pct: (shares[k] ?? 0) / total, bg: MTG_COLORS[k]!.bg })).filter(
    (s) => s.pct > 0.01,
  );
  return (
    <div className="flex w-full overflow-hidden rounded-sm" style={{ height: 10 }}>
      {segments.map((s) => (
        <div
          key={s.key}
          style={{ width: `${s.pct * 100}%`, background: s.bg }}
          title={`${s.key}: ${(s.pct * 100).toFixed(0)}%`}
        />
      ))}
    </div>
  );
};

/** Reads the --text CSS variable as an rgb() string, reacting to theme changes. */
function useChartTextColor(): string {
  const read = () => {
    if (typeof document === 'undefined') return 'rgb(33,37,41)';
    const v = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
    return v ? `rgb(${v})` : 'rgb(33,37,41)';
  };
  const [color, setColor] = React.useState(read);
  React.useEffect(() => {
    const obs = new MutationObserver(() => setColor(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => obs.disconnect();
  }, []);
  return color;
}

function makeDoughnutOptions(textColor: string) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    animation: false as const,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          usePointStyle: true,
          padding: 10,
          font: { size: 11 },
          color: textColor,
          generateLabels: (chart: any) => {
            const data = chart.data;
            return (data.labels as string[]).map((label: string, i: number) => ({
              text: `${label}  ${(data.datasets[0].data[i] as number).toFixed(0)}%`,
              fillStyle: data.datasets[0].backgroundColor[i],
              strokeStyle: data.datasets[0].backgroundColor[i],
              fontColor: textColor,
              pointStyle: 'circle' as const,
              hidden: false,
              index: i,
            }));
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.label}: ${(ctx.raw as number).toFixed(1)}%`,
        },
      },
    },
    cutout: '55%',
  };
}

function makeEloHistogramOptions(textColor: string) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, color: textColor } },
      y: { beginAtZero: true, grid: { display: false }, ticks: { font: { size: 10 }, color: textColor } },
    },
    plugins: { legend: { display: false } },
  };
}

const DeckColorShareChart: React.FC<{ deckBuilds: BuiltDeck[] | null; cardMeta: Record<string, CardMeta> }> = ({
  deckBuilds,
  cardMeta,
}) => {
  const textColor = useChartTextColor();
  if (!deckBuilds || deckBuilds.length === 0) {
    return <Text sm className="text-text-secondary">Unavailable for this filter.</Text>;
  }

  const shares: Record<string, number> = Object.fromEntries(COLOR_KEYS_WITH_C.map((key) => [key, 0]));
  for (const deck of deckBuilds) {
    for (const oracle of deck.mainboard) {
      const cardColors = getDeckShareColors(oracle, cardMeta);
      if (cardColors.length === 0) continue;
      const share = 1 / cardColors.length;
      for (const color of cardColors) shares[color] = (shares[color] ?? 0) + share;
    }
  }
  const totalShare = Object.values(shares).reduce((sum, v) => sum + v, 0);
  const segments = COLOR_KEYS_WITH_C.map((key) => ({
    key,
    label: MTG_COLORS[key]!.label,
    bg: MTG_COLORS[key]!.bg,
    pct: totalShare > 0 ? (shares[key] ?? 0) / totalShare : 0,
  })).filter((s) => s.pct > 0.005);

  const chartData = {
    labels: segments.map((s) => s.label),
    datasets: [
      {
        data: segments.map((s) => s.pct * 100),
        backgroundColor: segments.map((s) => s.bg),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
      },
    ],
  };

  return (
    <div className="w-full">
      <Doughnut data={chartData} options={makeDoughnutOptions(textColor)} />
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

const HISTOGRAM_HEIGHT = 56; // px — bar drawing area

const ManaCurveShareChart: React.FC<{ deckBuilds: BuiltDeck[] | null; cardMeta: Record<string, CardMeta> }> = ({
  deckBuilds,
  cardMeta,
}) => {
  if (!deckBuilds || deckBuilds.length === 0) {
    return <Text sm className="text-text-secondary">Unavailable for this filter.</Text>;
  }

  const counts: Record<string, number> = Object.fromEntries(MANA_CURVE_BUCKETS.map((b) => [b.key, 0]));
  let totalCards = 0;
  for (const deck of deckBuilds) {
    for (const oracle of deck.mainboard) {
      const meta = cardMeta[oracle];
      if ((meta?.type ?? '').toLowerCase().includes('land')) continue;
      const cmc = Math.max(0, Math.floor(meta?.cmc ?? 0));
      const key = cmc >= 7 ? '7+' : String(cmc);
      counts[key] = (counts[key] ?? 0) + 1;
      totalCards++;
    }
  }

  const buckets = MANA_CURVE_BUCKETS.map((b) => ({
    ...b,
    pct: totalCards > 0 ? (counts[b.key] ?? 0) / totalCards : 0,
  }));
  const maxPct = Math.max(...buckets.map((b) => b.pct), 0.001);

  return (
    <div className="flex flex-col gap-1">
      {/* Histogram bars */}
      <div className="flex items-end gap-1" style={{ height: HISTOGRAM_HEIGHT }}>
        {buckets.map((b) => {
          const barH = Math.round((b.pct / maxPct) * HISTOGRAM_HEIGHT);
          return (
            <div key={b.key} className="flex-1 flex flex-col items-center justify-end" style={{ height: HISTOGRAM_HEIGHT }}>
              {b.pct > 0 && (
                <div
                  title={`${b.label}: ${(b.pct * 100).toFixed(1)}%`}
                  style={{
                    height: Math.max(3, barH),
                    width: '100%',
                    borderRadius: '4px 4px 0 0',
                    background: 'rgb(var(--link) / 0.65)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Baseline */}
      <div className="w-full" style={{ height: 1, background: 'rgb(var(--border))' }} />
      {/* X-axis labels */}
      <div className="flex gap-1">
        {buckets.map((b) => (
          <div key={b.key} className="flex-1 text-center text-[10px] text-text-secondary">{b.label}</div>
        ))}
      </div>
      {/* Value row — compact, under axis */}
      <div className="flex gap-1 mt-0.5">
        {buckets.map((b) => (
          <div key={b.key} className="flex-1 text-center text-[10px] font-semibold text-text tabular-nums">
            {b.pct > 0 ? `${(b.pct * 100).toFixed(0)}%` : ''}
          </div>
        ))}
      </div>
    </div>
  );
};

const CARD_TYPE_COLORS: Record<string, string> = {
  Creature: '#6AB572',
  Instant: '#67A6D3',
  Sorcery: '#D85F69',
  Enchantment: '#DBC467',
  Artifact: '#ADADAD',
  Planeswalker: '#9B59B6',
  Land: '#8B7355',
  Battle: '#E8883A',
  Other: '#555555',
};

const CARD_TYPE_ORDER = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land', 'Battle', 'Other'];

function getMajorCardType(typeStr: string): string {
  for (const t of CARD_TYPE_ORDER) {
    if (t !== 'Other' && typeStr.includes(t)) return t;
  }
  return 'Other';
}

const CardTypeShareChart: React.FC<{ deckBuilds: BuiltDeck[] | null; cardMeta: Record<string, CardMeta> }> = ({
  deckBuilds,
  cardMeta,
}) => {
  const textColor = useChartTextColor();
  if (!deckBuilds || deckBuilds.length === 0) {
    return <Text sm className="text-text-secondary">Unavailable for this filter.</Text>;
  }

  const counts: Record<string, number> = Object.fromEntries(CARD_TYPE_ORDER.map((t) => [t, 0]));
  for (const deck of deckBuilds) {
    for (const oracle of deck.mainboard) {
      const typeStr = cardMeta[oracle]?.type ?? '';
      if (/Basic Land/i.test(typeStr)) continue;
      const t = getMajorCardType(typeStr);
      counts[t] = (counts[t] ?? 0) + 1;
    }
  }

  const entries = CARD_TYPE_ORDER.map((t) => ({ label: t, count: counts[t] ?? 0, bg: CARD_TYPE_COLORS[t]! })).filter(
    (e) => e.count > 0,
  );
  const total = entries.reduce((s, e) => s + e.count, 0);

  const chartData = {
    labels: entries.map((e) => e.label),
    datasets: [
      {
        data: entries.map((e) => (total > 0 ? (e.count / total) * 100 : 0)),
        backgroundColor: entries.map((e) => e.bg),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
      },
    ],
  };

  return (
    <div className="w-full">
      <Doughnut data={chartData} options={makeDoughnutOptions(textColor)} />
    </div>
  );
};

const EloDistributionChart: React.FC<{ deckBuilds: BuiltDeck[] | null; cardMeta: Record<string, CardMeta> }> = ({
  deckBuilds,
  cardMeta,
}) => {
  const textColor = useChartTextColor();
  if (!deckBuilds || deckBuilds.length === 0) {
    return <Text sm className="text-text-secondary">Unavailable for this filter.</Text>;
  }

  const elos: number[] = [];
  for (const deck of deckBuilds) {
    for (const oracle of deck.mainboard) {
      const elo = cardMeta[oracle]?.elo;
      if (elo) elos.push(elo);
    }
  }
  if (elos.length === 0) return <Text sm className="text-text-secondary">No Elo data available.</Text>;

  const minElo = Math.floor(elos.reduce((a, b) => Math.min(a, b), Infinity) / 50) * 50;
  const maxElo = Math.ceil(elos.reduce((a, b) => Math.max(a, b), -Infinity) / 50) * 50;
  const labels: string[] = [];
  const counts: number[] = [];
  for (let bucket = minElo; bucket < maxElo; bucket += 50) {
    labels.push(String(bucket));
    counts.push(elos.filter((e) => e >= bucket && e < bucket + 50).length);
  }

  const chartData = {
    labels,
    datasets: [{ data: counts, backgroundColor: '#67A6D3', borderRadius: 2 }],
  };

  return <Bar data={chartData} options={makeEloHistogramOptions(textColor)} />;
};

function legacyComputeDraftMapPoints(
  slimPools: SlimPool[],
  displayedPools: SimulatedPool[],
  skeletons: ArchetypeSkeleton[],
  umapCoords: { x: number; y: number }[],
  poolArchetypeLabels: Map<number, string> | null,
  skeletonColorProfiles: Map<number, string>,
): DraftMapPoint[] {
  if (!umapCoords || slimPools.length === 0 || umapCoords.length !== slimPools.length) return [];

  const clusterByPoolIndex = new Map<number, { clusterId: number; clusterIndex: number; label: string }>();
  skeletons.forEach((skeleton, index) => {
    const label = getSkeletonDisplayName(skeleton, poolArchetypeLabels, skeletonColorProfiles);
    for (const poolIndex of skeleton.poolIndices) {
      clusterByPoolIndex.set(poolIndex, {
        clusterId: skeleton.clusterId,
        clusterIndex: index,
        label,
      });
    }
  });

  return slimPools.map((pool, poolIndex) => {
    const coord = umapCoords[poolIndex]!;
    const cluster = clusterByPoolIndex.get(poolIndex);
    return {
      x: coord.x,
      y: coord.y,
      poolIndex,
      draftIndex: pool.draftIndex,
      seatIndex: pool.seatIndex,
      clusterId: cluster?.clusterId ?? null,
      clusterIndex: cluster?.clusterIndex ?? null,
      clusterLabel: cluster?.label ?? 'Unclustered',
      archetype: displayedPools[poolIndex]?.archetype ?? pool.archetype,
    };
  });
}

type PoolViewMode = 'pool' | 'deck' | 'fullPickOrder';

interface CubeDraftSimulatorPageProps {
  cube: Cube;
}

const CubeDraftSimulatorPage: React.FC<CubeDraftSimulatorPageProps> = ({ cube }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const cubeId = getCubeId(cube);
  const isMobileLayout = useIsMobileLayout();

  // Controls
  const [numDrafts, setNumDrafts] = useState(100);
  const [numSeats, setNumSeats] = useState(8);
  const [gpuBatchSize, setGpuBatchSize] = useState(() => (isMobileLayout ? 4 : 32));
  const [selectedFormatId, setSelectedFormatId] = useState(cube.defaultFormat ?? -1);

  // Session-level cache — avoids recomputing embeddings when switching between runs
  const embeddingsCache = useRef<Map<string, number[][] | Record<string, number[]> | null>>(new Map());
  // Cache for computeFilteredCardStats — keyed by sorted pool indices joined as a string.
  // The computation is O(drafts × seats × picks) and runs synchronously on the main thread.
  const filteredCardStatsCache = useRef<Map<string, ReturnType<typeof computeFilteredCardStats>>>(new Map());
  const [deleteRunModalOpen, setDeleteRunModalOpen] = useState(false);
  const [runPendingDelete, setRunPendingDelete] = useState<SimulationRunEntry | null>(null);
  const [clearHistoryModalOpen, setClearHistoryModalOpen] = useState(false);

  // Card pool view
  const [selectedCardOracles, setSelectedCardOracles] = useState<string[]>([]);
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [selectedSkeletonId, setSelectedSkeletonId] = useState<number | null>(null);
  const [focusedPoolIndex, setFocusedPoolIndex] = useState<number | null>(null);
  const [focusedPoolViewMode, setFocusedPoolViewMode] = useState<PoolViewMode>('deck');
  const [inspectingPoolIndex, setInspectingPoolIndex] = useState<number | null>(null);
  const detailedViewRef = useRef<HTMLDivElement>(null);
  const cardStatsRef = useRef<HTMLDivElement>(null);

  // Section collapse state (default open)
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [detailedViewOpen, setDetailedViewOpen] = useState(true);
  const [draftBreakdownOpen, setDraftBreakdownOpen] = useState(true);
  const [referenceOpen, setReferenceOpen] = useState(true);
  const [archetypesOpen, setArchetypesOpen] = useState(true);
  const [deckColorOpen, setDeckColorOpen] = useState(true);
  const [cardStatsOpen, setCardStatsOpen] = useState(true);
  const [bottomTab, setBottomTab] = useState<DraftSimulatorBottomTab>('archetypes');
  const [pairingsExcludeLands, setPairingsExcludeLands] = useState(true);
  const [excludeManaFixingLands, setExcludeManaFixingLands] = useState(true);
  const [draftMapColorMode, setDraftMapColorMode] = useState<DraftMapColorMode>('cluster');

  const resetViewSelection = useCallback(() => {
    setSelectedCardOracles([]);
    setSelectedArchetype(null);
    setSelectedSkeletonId(null);
    setFocusedPoolIndex(null);
    setFocusedPoolViewMode('deck');
    setBottomTab('archetypes');
    setDraftMapColorMode('cluster');
  }, []);

  const resetSessionCaches = useCallback(() => {
    embeddingsCache.current = new Map();
    filteredCardStatsCache.current = new Map();
  }, []);

  const {
    runs,
    displayRunData,
    currentRunSetup,
    selectedTs,
    loadedClusterCache,
    clusterCachePending,
    loadingRun,
    historyLoadError,
    loadRunError,
    storageNotice,
    setCurrentRunSetup,
    setStorageNotice,
    setClusterCachePending,
    handleLoadRun,
    handleDeleteRun,
    handleClearHistory,
    handlePersistCompletedRun,
    handlePersistClusterCache,
  } = useLocalSimulationHistory({
    cubeId,
    onResetViewSelection: resetViewSelection,
    onResetSessionCaches: resetSessionCaches,
  });

  // Archetype skeleton clustering
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showAdvancedClustering, setShowAdvancedClustering] = useState(false);

  // Reconstruct SimulatedPool[] from slim pools for display (works for both fresh and historical)
  const simulatedPools = useMemo(
    () => (displayRunData ? reconstructSimulatedPools(displayRunData.slimPools, displayRunData.cardMeta) : []),
    [displayRunData],
  );

  // Build decks client-side using the TF.js deck_build_decoder + draft_decoder
  const buildAllDecks = useCallback(
    async (
      slimPools: SlimPool[],
      setup: SimulationSetupResponse,
      signal?: AbortSignal,
      batchSize = gpuBatchSize,
    ): Promise<{ decks: BuiltDeck[]; basicCardMeta: Record<string, CardMeta> } | null> => {
      if (slimPools.length === 0) return { decks: [], basicCardMeta: {} };
      try {
        const entries: DeckbuildEntry[] = slimPools.map((pool) => ({
          pool: pool.picks.map((p) => p.oracle_id),
          cardMeta: setup.cardMeta,
          basics: setup.basics,
        }));
        const decks = await localBatchDeckbuild(entries, batchSize, signal);
        // Collect metadata for any basic oracle IDs that appear in mainboards but aren't in setup.cardMeta
        const basicCardMeta: Record<string, CardMeta> = {};
        for (const basic of setup.basics) {
          if (!setup.cardMeta[basic.oracleId]) {
            basicCardMeta[basic.oracleId] = {
              name: basic.name,
              imageUrl: basic.imageUrl,
              colorIdentity: basic.colorIdentity,
              elo: 1200,
              cmc: 0,
              type: basic.type,
              producedMana: basic.producedMana,
            };
          }
        }
        return { decks, basicCardMeta };
      } catch (err) {
        if (err instanceof WebGLInferenceError || (err instanceof Error && err.name === 'AbortError')) throw err;
        console.error('localBatchDeckbuild error:', err);
        return null;
      }
    },
    [gpuBatchSize],
  );

  const availableFormats = useMemo(
    () => [
      { value: '-1', label: 'Standard Draft' },
      ...(cube.formats ?? []).map((format: any, index: number) => ({
        value: `${index}`,
        label: format.title || `Format ${index + 1}`,
      })),
    ],
    [cube.formats],
  );

  useEffect(() => {
    void prefetchClientSimulationResources(csrfFetch, cubeId);
  }, [csrfFetch, cubeId]);

  const {
    status,
    simPhase,
    modelLoadProgress,
    simProgress,
    errorMsg,
    simAbortRef,
    isRunning,
    overallSimProgress,
    leaveModalOpen,
    handleCancelLeave,
    handleConfirmedLeave,
    handleStart,
    handleCancel,
  } = useSimulationRun({
    csrfFetch,
    cubeId,
    numDrafts,
    numSeats,
    gpuBatchSize,
    selectedFormatId,
    buildAllDecks,
    runClientSimulation,
    nextLowerGpuBatchSize,
    onResetViewSelection: resetViewSelection,
    onSimulationStart: () => {},
    onSetCurrentRunSetup: setCurrentRunSetup,
    onSetStorageNotice: setStorageNotice,
    onSetClusterCachePending: setClusterCachePending,
    onPersistCompletedRun: handlePersistCompletedRun,
    onPersistClusterCache: handlePersistClusterCache,
  });

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
  const cubeOracleSet = useMemo(() => new Set(Object.keys(displayRunData?.cardMeta ?? {})), [displayRunData?.cardMeta]);
  const {
    pendingKnnK,
    setPendingKnnK,
    pendingResolution,
    setPendingResolution,
    skeletons,
    umapCoords,
    clusteringInProgress,
    clusteringPhase,
    poolArchetypeLabels,
    poolArchetypeLabelsLoading,
    oovWarningPct,
    applyPendingClusteringSettings,
  } = useClusteringPipeline({
    cubeId,
    displayRunData,
    activeDecks,
    selectedTs,
    loadedClusterCache,
    clusterCachePending,
    embeddingsCache,
  });

  // Deck-based color profiles for each skeleton (same logic as ArchetypeSkeletonCard's useMemo)
  const skeletonColorProfiles = useMemo<Map<number, string>>(() => {
    if (!displayRunData?.deckBuilds || skeletons.length === 0) return new Map();
    return new Map(skeletons.map((sk) => [sk.clusterId, computeSkeletonColorProfile(sk, displayRunData.deckBuilds, displayRunData.cardMeta)]));
  }, [skeletons, displayRunData?.deckBuilds, displayRunData?.cardMeta]);
  const derivedData = useMemo<DraftSimulatorDerivedData>(
    () => ({
      displayRunData,
      currentRunSetup,
      displayedPools,
      activeDecks,
      skeletons,
      poolArchetypeLabels,
      skeletonColorProfiles,
    }),
    [displayRunData, currentRunSetup, displayedPools, activeDecks, skeletons, poolArchetypeLabels, skeletonColorProfiles],
  );
  const selectionState = useMemo<DraftSimulatorSelectionState>(
    () => ({
      selectedCardOracles,
      selectedSkeletonId,
      selectedArchetype,
      focusedPoolIndex,
      focusedPoolViewMode,
    }),
    [selectedCardOracles, selectedSkeletonId, selectedArchetype, focusedPoolIndex, focusedPoolViewMode],
  );
  const selectionSetters = useMemo<DraftSimulatorSelectionSetters>(
    () => ({
      setSelectedCardOracles,
      setSelectedArchetype,
      setSelectedSkeletonId,
      setFocusedPoolIndex,
    }),
    [setSelectedCardOracles, setSelectedArchetype, setSelectedSkeletonId, setFocusedPoolIndex],
  );

  // Top Gwen archetype labels per color pair, for the Deck Color Distribution chart
  const colorPairTopArchetypes = useMemo<Map<string, string[]>>(() => {
    if (!poolArchetypeLabels || !displayedPools.length) return new Map();
    const buckets = new Map<string, Map<string, number>>();
    for (const pool of displayedPools) {
      const label = poolArchetypeLabels.get(pool.poolIndex);
      if (!label) continue;
      if (!buckets.has(pool.archetype)) buckets.set(pool.archetype, new Map());
      const counts = buckets.get(pool.archetype)!;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const result = new Map<string, string[]>();
    for (const [colorPair, counts] of buckets) {
      result.set(colorPair, [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l]) => l));
    }
    return result;
  }, [poolArchetypeLabels, displayedPools]);
  const draftMapPoints = useMemo(
    () =>
      displayRunData
        ? computeDraftMapPoints(
            displayRunData.slimPools,
            displayedPools,
            skeletons,
            umapCoords,
            poolArchetypeLabels,
            skeletonColorProfiles,
            getSkeletonDisplayName,
          )
        : [],
    [displayRunData, displayedPools, skeletons, umapCoords, poolArchetypeLabels, skeletonColorProfiles],
  );

  // Cluster theme analysis — shared between the archetype list (byClusterId) and DraftBreakdownTable
  // (poolThemes + tagAllowlist). Computed once per (runData, skeletons, pools, decks) tuple.
  const { clusterThemesByClusterId, allPoolClusterThemes, allPoolTagAllowlist } = useMemo(() => {
    if (!displayRunData || skeletons.length === 0) {
      return {
        clusterThemesByClusterId: new Map<number, string[]>(),
        allPoolClusterThemes: undefined,
        allPoolTagAllowlist: undefined,
      };
    }
    const { poolThemes, tagAllowlist } = computeClusterThemes(skeletons, displayedPools, activeDecks, displayRunData.cardMeta);
    const byClusterId = new Map<number, string[]>();
    for (const skeleton of skeletons) {
      // Merge ranked tags from all pools in the cluster (union by tag, keep highest lift)
      const merged = new Map<string, { tag: string; lift: number }>();
      for (const poolIndex of skeleton.poolIndices) {
        const rankedTags = poolThemes.get(poolIndex);
        if (!rankedTags) continue;
        for (const entry of rankedTags) {
          const existing = merged.get(entry.tag);
          if (!existing || entry.lift > existing.lift) merged.set(entry.tag, entry);
        }
      }
      if (merged.size > 0) {
        const sorted = [...merged.values()].sort((a, b) => b.lift - a.lift);
        byClusterId.set(skeleton.clusterId, formatClusterThemeLabels(sorted));
      }
    }
    return {
      clusterThemesByClusterId: byClusterId,
      allPoolClusterThemes: poolThemes,
      allPoolTagAllowlist: tagAllowlist,
    };
  }, [displayRunData, skeletons, displayedPools, activeDecks]);

  const {
    selectedCards,
    selectedCard,
    activeFilterPoolIndexSet,
    filteredDecks,
    deckInclusionPct,
    inDeckOracles,
    inSideboardOracles,
    visibleCardStats,
    selectedCardStats,
    visiblePoolCounts,
    hasApproximateFilteredStats,
    scopedPools,
    activeFilterPreview,
    topSideboardCards,
    topCardPairings,
  } = useDraftSimulatorSelection({
    data: derivedData,
    state: selectionState,
    filteredCardStatsCache,
    computeFilteredCardStats,
    bottomTab,
    pairingsExcludeLands,
  });
  const {
    selectedPools,
    focusedPool,
    focusedDeck,
    focusedDeckAvailable,
    focusedFullPickOrderAvailable,
    effectiveFocusedPoolViewMode,
    showDraftMapScopePanel,
    mapPanelHasBoth,
    draftMapScopeSeatCount,
    draftMapScopeSubtitle,
    statsForScope,
  } = useDraftSimulatorFocus({
    data: derivedData,
    state: selectionState,
    activeFilterPoolIndexSet,
    selectedCards,
    selectedCard,
    selectedCardStats,
  });
  const {
    activeFilterSummary,
    scopeOnlySummary,
    filterChipItems,
    selectedCardScopeLabel,
    detailedViewTitle,
    detailedViewSubtitle,
    clearActiveFilter,
    downloadDraftBreakdownCsv,
    downloadCardStatsCsv,
    scopedCardStatsTitle,
    draftBreakdownTitle,
    sideboardTitle,
    pairingsTitle,
    overperformersTitleSuffix,
  } = useDraftSimulatorPresentation({
    data: derivedData,
    state: selectionState,
    setters: selectionSetters,
    selectedCards,
    selectedCard,
    activeFilterPoolIndexSet,
    selectedPools,
    getSkeletonDisplayName,
    buildDraftBreakdownRowSummary,
  });

  const handleToggleSelectedCard = useCallback((oracleId: string) => {
    setSelectedCardOracles((current) => {
      if (current.includes(oracleId)) return current.filter((id) => id !== oracleId);
      if (current.length < 2) return [...current, oracleId];
      return [current[1]!, oracleId];
    });
  }, []);

  const inspectingPool = useMemo(
    () => (inspectingPoolIndex === null ? null : displayedPools.find((p) => p.poolIndex === inspectingPoolIndex) ?? null),
    [inspectingPoolIndex, displayedPools],
  );
  const inspectingDeck = useMemo(
    () => (inspectingPool ? activeDecks?.[inspectingPool.poolIndex] ?? null : null),
    [inspectingPool, activeDecks],
  );
  const inspectingThemes = useMemo(
    () =>
      inspectingPool && displayRunData
        ? inferDraftThemes(inspectingPool, inspectingDeck, displayRunData.cardMeta, allPoolClusterThemes, allPoolTagAllowlist)
        : [],
    [inspectingPool, inspectingDeck, displayRunData, allPoolClusterThemes, allPoolTagAllowlist],
  );
  const inspectingThemeBreakdown = useMemo(() => {
    if (!inspectingPool || !displayRunData) return undefined;
    const mainCards = getPoolMainCards(inspectingPool, inspectingDeck, displayRunData.cardMeta);
    const bucketMap = new Map<string, { name: string; rawTags: string[] }[]>();
    for (const oracleId of mainCards) {
      const meta = displayRunData.cardMeta[oracleId];
      if (!meta?.oracleTags) continue;
      const byBucket = new Map<string, string[]>();
      for (const tag of meta.oracleTags) {
        const bucket = OTAG_BUCKET_MAP[tag];
        if (!bucket) continue;
        if (!byBucket.has(bucket)) byBucket.set(bucket, []);
        byBucket.get(bucket)!.push(tag);
      }
      for (const [bucket, rawTags] of byBucket) {
        if (!bucketMap.has(bucket)) bucketMap.set(bucket, []);
        bucketMap.get(bucket)!.push({ name: meta.name, rawTags });
      }
    }
    return [...bucketMap.entries()]
      .filter(([, cards]) => cards.length > 1)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([bucket, cards]) => ({ bucket, cards }));
  }, [inspectingPool, inspectingDeck, displayRunData]);

  const selectedSkeleton = useMemo(
    () => skeletons.find((skeleton) => skeleton.clusterId === selectedSkeletonId) ?? null,
    [skeletons, selectedSkeletonId],
  );
  const selectedClusterDeckBuilds = useMemo(
    () =>
      selectedSkeleton && activeDecks
        ? selectedSkeleton.poolIndices.map((poolIndex) => activeDecks[poolIndex]).filter((deck): deck is BuiltDeck => !!deck)
        : null,
    [selectedSkeleton, activeDecks],
  );
  const selectedColorPoolIndices = useMemo(
    () =>
      selectedArchetype
        ? displayedPools.filter((pool) => pool.archetype === selectedArchetype).map((pool) => pool.poolIndex)
        : [],
    [displayedPools, selectedArchetype],
  );
  const selectedColorDeckBuilds = useMemo(
    () =>
      activeDecks && selectedColorPoolIndices.length > 0
        ? selectedColorPoolIndices.map((poolIndex) => activeDecks[poolIndex]).filter((deck): deck is BuiltDeck => !!deck)
        : null,
    [activeDecks, selectedColorPoolIndices],
  );
  const mobileSelectedCardInfo = useMemo(() => {
    if (!(mapPanelHasBoth && selectedCards.length > 0 && displayRunData)) return undefined;
    return {
      cardImages: selectedCards
        .map((c) => ({ oracleId: c.oracle_id, name: c.name, imageUrl: displayRunData.cardMeta[c.oracle_id]?.imageUrl ?? '' }))
        .filter((img) => img.imageUrl),
      name: selectedCards.map((c) => c.name).join(' + '),
      pickRate: selectedCards.length === 1 ? (statsForScope?.pickRate ?? selectedCard?.pickRate) : undefined,
      avgPickPosition: selectedCards.length === 1 ? (statsForScope?.avgPickPosition ?? selectedCard?.avgPickPosition) : undefined,
      onClear: () => setSelectedCardOracles([]),
    };
  }, [mapPanelHasBoth, selectedCards, displayRunData, statsForScope, selectedCard]);

  useEffect(() => {
    if (!isMobileLayout) return;
    if (bottomTab === 'archetypes' || bottomTab === 'deckColor') {
      setBottomTab('draftBreakdown');
    }
  }, [isMobileLayout, bottomTab]);

  const resultsOverviewNode = displayRunData ? (
    <DraftSimulatorOverviewSection
      displayRunData={displayRunData}
      activeDecks={activeDecks}
      overviewOpen={overviewOpen}
      setOverviewOpen={setOverviewOpen}
      mobileLayout={isMobileLayout}
    />
  ) : null;

  const resultsFilterNode = displayRunData ? (
    <DraftSimulatorFilterBar
      chips={filterChipItems}
      matchingPools={activeFilterPoolIndexSet?.size ?? displayRunData.slimPools.length}
      totalPools={displayRunData.slimPools.length}
      cardStats={displayRunData.cardStats}
      selectedCardOracles={selectedCardOracles}
      archetypeDistribution={displayedArchetypeDistribution}
      selectedArchetype={selectedArchetype}
      skeletons={skeletons}
      selectedSkeletonId={selectedSkeletonId}
      onAddCard={handleToggleSelectedCard}
      onSelectArchetype={(archetype) => {
        setSelectedArchetype(archetype);
        if (archetype !== null) setSelectedSkeletonId(null);
      }}
      onSelectSkeleton={(clusterId) => {
        setSelectedSkeletonId(clusterId);
        if (clusterId !== null) setSelectedArchetype(null);
      }}
      onClearAll={clearActiveFilter}
      renderArchetypeLabel={archetypeFullName}
      renderSkeletonLabel={(skeleton) => getSkeletonDisplayName(skeleton, poolArchetypeLabels, skeletonColorProfiles)}
    />
  ) : null;

  const resultsOovWarningNode =
    oovWarningPct !== null ? (
      <div className="rounded-lg border border-yellow-500 bg-yellow-500/10 px-4 py-3 mb-2">
        <Text sm className="text-text">
          {Math.round(oovWarningPct * 100)}% of cards in this cube aren't in the ML model's training vocabulary. Pick
          simulation and deckbuilding quality may be reduced for those cards.
        </Text>
      </div>
    ) : null;

  const resultsBottomNode = displayRunData ? (
    <DraftSimulatorBottomSection
      mobileLayout={isMobileLayout}
      bottomTab={bottomTab}
      setBottomTab={setBottomTab}
      displayRunData={displayRunData}
      clusteringInProgress={clusteringInProgress}
      clusteringPhase={clusteringPhase}
      skeletons={skeletons}
      selectedSkeletonId={selectedSkeletonId}
      setSelectedSkeletonId={setSelectedSkeletonId}
      clusterThemesByClusterId={clusterThemesByClusterId}
      poolArchetypeLabels={poolArchetypeLabels}
      poolArchetypeLabelsLoading={poolArchetypeLabelsLoading}
      skeletonColorProfiles={skeletonColorProfiles}
      selectedArchetype={selectedArchetype}
      setSelectedArchetype={setSelectedArchetype}
      displayedArchetypeDistribution={displayedArchetypeDistribution}
      colorPairTopArchetypes={colorPairTopArchetypes}
      clearActiveFilter={clearActiveFilter}
      activeFilterPoolIndexSet={activeFilterPoolIndexSet}
      hasApproximateFilteredStats={hasApproximateFilteredStats}
      scopedCardStatsTitle={scopedCardStatsTitle}
      draftBreakdownTitle={draftBreakdownTitle}
      sideboardTitle={sideboardTitle}
      pairingsTitle={pairingsTitle}
      overperformersTitleSuffix={overperformersTitleSuffix}
      downloadCardStatsCsv={downloadCardStatsCsv}
      visibleCardStats={visibleCardStats}
      handleToggleSelectedCard={handleToggleSelectedCard}
      selectedCardOracles={selectedCardOracles}
      inDeckOracles={inDeckOracles}
      inSideboardOracles={inSideboardOracles}
      deckInclusionPct={deckInclusionPct}
      visiblePoolCounts={visiblePoolCounts}
      cardStatsRef={cardStatsRef}
      detailedViewRef={detailedViewRef}
      downloadDraftBreakdownCsv={downloadDraftBreakdownCsv}
      displayedPools={displayedPools}
      activeDecks={activeDecks}
      simPhase={simPhase}
      selectedCard={selectedCard}
      focusedPoolIndex={focusedPoolIndex}
      setFocusedPoolIndex={setFocusedPoolIndex}
      onInspectPool={setInspectingPoolIndex}
      allPoolClusterThemes={allPoolClusterThemes}
      allPoolTagAllowlist={allPoolTagAllowlist}
      topSideboardCards={topSideboardCards}
      topCardPairings={topCardPairings}
      pairingsExcludeLands={pairingsExcludeLands}
      setPairingsExcludeLands={setPairingsExcludeLands}
      excludeManaFixingLands={excludeManaFixingLands}
      status={status}
      renderAutocardNameLink={renderAutocardNameLink}
    />
  ) : null;

  const resultsMapNode = displayRunData && !isMobileLayout ? (
    <div className="simSection simSectionCards flex flex-col gap-5 pt-2">
      <Flexbox direction="col" gap="4">
        <div className="simCardDiagBlock simCardDiagSummary flex flex-col gap-4">
          <DraftMapCard
            skeletons={skeletons}
            showAdvancedClustering={showAdvancedClustering}
            pendingKnnK={pendingKnnK}
            setPendingKnnK={setPendingKnnK}
            pendingResolution={pendingResolution}
            setPendingResolution={setPendingResolution}
            clusteringInProgress={clusteringInProgress}
            clusteringPhase={clusteringPhase}
            applyPendingClusteringSettings={applyPendingClusteringSettings}
            draftMapPoints={draftMapPoints}
            showDraftMapScopePanel={showDraftMapScopePanel}
            activeFilterPoolIndexSet={activeFilterPoolIndexSet}
            draftMapColorMode={draftMapColorMode}
            setDraftMapColorMode={setDraftMapColorMode}
            focusedPoolIndex={focusedPoolIndex}
            setFocusedPoolIndex={setFocusedPoolIndex}
            setSelectedSkeletonId={setSelectedSkeletonId}
            selectedSkeletonId={selectedSkeletonId}
            setSelectedArchetype={setSelectedArchetype}
            setDraftBreakdownOpen={setDraftBreakdownOpen}
            mapPanelHasBoth={mapPanelHasBoth}
            selectedCards={selectedCards}
            displayRunData={displayRunData}
            selectedCard={selectedCard}
            selectedCardStats={selectedCardStats}
            statsForScope={statsForScope}
            selectedCardScopeLabel={selectedCardScopeLabel}
            detailedViewTitle={detailedViewTitle}
            detailedViewSubtitle={detailedViewSubtitle}
            activeFilterPreview={activeFilterPreview}
            activeDecks={activeDecks}
            clusterThemesByClusterId={clusterThemesByClusterId}
            poolArchetypeLabels={poolArchetypeLabels}
            colorPairTopArchetypes={colorPairTopArchetypes}
            activeFilterSummary={activeFilterSummary}
            scopeOnlySummary={scopeOnlySummary}
            filteredDecks={filteredDecks}
            draftMapScopeSubtitle={draftMapScopeSubtitle}
            draftMapScopeSeatCount={draftMapScopeSeatCount}
            onClearSelectedCards={() => setSelectedCardOracles([])}
            cubeOracleSet={cubeOracleSet}
            excludeManaFixingLands={excludeManaFixingLands}
            setExcludeManaFixingLands={setExcludeManaFixingLands}
            onInspectPool={setInspectingPoolIndex}
            selectedArchetype={selectedArchetype}
            selectedColorPoolIndices={selectedColorPoolIndices}
            selectedColorDeckBuilds={selectedColorDeckBuilds}
            onToggleSelectedCard={handleToggleSelectedCard}
          />
        </div>
      </Flexbox>
    </div>
  ) : null;

  const resultsMobileDetailNode = displayRunData && isMobileLayout && (showDraftMapScopePanel || selectedSkeleton) ? (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Text semibold>Detailed View</Text>
          </div>
          <button
            type="button"
            onClick={() => setDetailedViewOpen((open) => !open)}
            className="text-xs text-text-secondary hover:text-text flex-shrink-0"
          >
            {detailedViewOpen ? 'Hide' : 'Show'}
          </button>
        </div>
      </CardHeader>
      <CardBody>
        <Collapse isOpen={detailedViewOpen}>
          <div className="flex flex-col gap-4">
            {selectedSkeleton && (
              <ClusterDetailPanel
                skeleton={selectedSkeleton}
                clusterIndex={skeletons.findIndex((s) => s.clusterId === selectedSkeleton.clusterId)}
                totalPools={displayRunData.slimPools.length}
                clusterDeckBuilds={selectedClusterDeckBuilds}
                cubeOracleSet={cubeOracleSet}
                cardMeta={displayRunData.cardMeta}
                slimPools={displayRunData.slimPools}
                deckBuilds={activeDecks}
                themes={clusterThemesByClusterId.get(selectedSkeleton.clusterId)}
                poolArchetypeLabels={poolArchetypeLabels}
                excludeManaFixingLands={excludeManaFixingLands}
                setExcludeManaFixingLands={setExcludeManaFixingLands}
                onOpenPool={setInspectingPoolIndex}
                onCardClick={handleToggleSelectedCard}
                onClose={() => setSelectedSkeletonId(null)}
              />
            )}
            {!selectedSkeleton && selectedArchetype && selectedColorPoolIndices.length > 0 && (
              <ColorProfileDetailPanel
                colorPair={selectedArchetype}
                poolIndices={selectedColorPoolIndices}
                totalPools={displayRunData.slimPools.length}
                subsetDeckBuilds={selectedColorDeckBuilds}
                cubeOracleSet={cubeOracleSet}
                cardMeta={displayRunData.cardMeta}
                slimPools={displayRunData.slimPools}
                deckBuilds={activeDecks}
                topArchetypeLabels={colorPairTopArchetypes.get(selectedArchetype)}
                excludeManaFixingLands={excludeManaFixingLands}
                setExcludeManaFixingLands={setExcludeManaFixingLands}
                onOpenPool={setInspectingPoolIndex}
                onCardClick={handleToggleSelectedCard}
                onClose={() => setSelectedArchetype(null)}
              />
            )}
            {!selectedSkeleton && !selectedArchetype && showDraftMapScopePanel && (
              <DraftMapScopePanel
                title={selectedSkeleton ? '' : activeFilterSummary ?? scopeOnlySummary ?? ''}
                subtitle={selectedSkeleton ? '' : draftMapScopeSubtitle}
                commonCards={activeFilterPreview?.commonCards}
                deckBuilds={filteredDecks ?? activeDecks}
                cardMeta={displayRunData.cardMeta}
                selectedCardInfo={mobileSelectedCardInfo}
                matchingCount={draftMapScopeSeatCount}
                excludeManaFixingLands={excludeManaFixingLands}
              />
            )}
          </div>
        </Collapse>
      </CardBody>
    </Card>
  ) : null;

  const resultsMobileArchetypesNode = displayRunData && isMobileLayout ? (
    <ArchetypeSkeletonSection
      skeletons={skeletons}
      totalPools={displayRunData.slimPools.length}
      selectedSkeletonId={selectedSkeletonId}
      onSelectSkeleton={(id) => {
        setSelectedSkeletonId(id);
        setSelectedArchetype(null);
      }}
      clusterThemesByClusterId={clusterThemesByClusterId}
      poolArchetypeLabels={poolArchetypeLabels}
      poolArchetypeLabelsLoading={poolArchetypeLabelsLoading}
      skeletonColorProfiles={skeletonColorProfiles}
      excludeManaFixingLands={excludeManaFixingLands}
    />
  ) : null;

  return (
    <MainLayout useContainer={false}>
      <DisplayContextProvider cubeID={cubeId}>
        <CubeLayout cube={cube} activeLink="draft-simulator">
          <Flexbox direction="col" gap="4" className="p-4">
            <DynamicFlash />

            {/* Simulator workspace */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-0.5">
                  <Text lg semibold>
                    Draft Simulator
                  </Text>
                  <Text sm className="text-text-secondary">
                    Simulate bot-only drafts to estimate pick rates, color trends, and archetype outcomes. The draft
                    simulation and deckbuilding run locally in your browser and results are stored on this device.
                    Machines with lower GPU or memory headroom may need to use Advanced Options to reduce batch size or
                    clustering work on larger runs.
                  </Text>
                </div>
              </CardHeader>
              <CardBody className="pt-3">
                {/* Controls grid — 5 fields + CTA as sixth column */}
                <div
                  className="grid gap-3 items-end"
                  style={
                    isMobileLayout
                      ? { gridTemplateColumns: 'repeat(1, minmax(0, 1fr))' }
                      : { gridTemplateColumns: 'repeat(5, minmax(0, 1fr)) auto' }
                  }
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-baseline gap-1.5">
                      <label className="text-xs font-medium text-text-secondary">Drafts</label>
                      {numDrafts > 300 && (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400">Large run — may be slow or time out.</span>
                      )}
                    </div>
                    <NumericInput min={1} value={numDrafts} onChange={setNumDrafts} disabled={isRunning} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-xs font-medium text-text-secondary" htmlFor="draftSimulatorFormat">Format</label>
                    <Select
                      id="draftSimulatorFormat"
                      options={availableFormats}
                      value={`${selectedFormatId}`}
                      setValue={(value) => setSelectedFormatId(parseInt(value, 10))}
                      disabled={isRunning}
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-xs font-medium text-text-secondary">Seats</label>
                    <NumericInput min={2} max={16} value={numSeats} onChange={setNumSeats} disabled={isRunning} />
                  </div>
                  {/* CTA — aligned to input baseline */}
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={handleStart}
                      disabled={isRunning}
                      className="px-5 py-2 rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold whitespace-nowrap"
                    >
                      {isRunning ? 'Simulating…' : 'Run Simulation'}
                    </button>
                    {isRunning && (
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="px-4 py-1.5 rounded border border-border text-sm text-text-secondary hover:bg-bg-active"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Recent runs strip */}
                {runs.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-3 mb-2">
                      <Text xs className="font-medium text-text-secondary/60 uppercase tracking-wide">Recent runs</Text>
                      <button
                        type="button"
                        className="text-xs text-text-secondary hover:text-text"
                        onClick={() => setClearHistoryModalOpen(true)}
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-0.5">
                      {runs.map((run) => (
                        <div
                          key={run.entry.ts}
                          className={[
                            'group relative flex flex-col flex-shrink-0 cursor-pointer transition-colors select-none rounded-md border overflow-hidden',
                            run.entry.ts === selectedTs
                              ? 'border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-800 shadow-[inset_3px_0_0_rgb(59_130_246)]'
                              : 'border-border bg-bg-accent hover:bg-bg-active',
                          ].join(' ')}
                          style={{ minWidth: 160, padding: '8px 28px 8px 13px' }}
                          onClick={() => handleLoadRun(run.entry.ts)}
                        >
                          <span className="text-sm font-semibold whitespace-nowrap leading-tight text-text">
                            {run.entry.numDrafts} drafts · {run.entry.numSeats} seats
                          </span>
                          <span className="text-[11px] text-text-secondary whitespace-nowrap mt-0.5">
                            {new Date(run.entry.generatedAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {!run.hasExactFiltering && (
                            <span className="mt-1 inline-flex w-fit rounded border border-yellow-500/40 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-300">
                              Limited filtering
                            </span>
                          )}
                          <button
                            type="button"
                            className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center rounded text-[9px] text-text-secondary/40 hover:text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRunPendingDelete(run.entry);
                              setDeleteRunModalOpen(true);
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {loadingRun && (
                        <Text xs className="text-text-secondary self-center flex-shrink-0">Loading…</Text>
                      )}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Progress */}
            {isRunning && (
              <Card>
                <CardBody>
                  <Flexbox direction="col" gap="2">
                    <Flexbox direction="row" justify="between">
                      <Text sm>
                        {simPhase === 'setup'
                          ? 'Preparing packs…'
                          : simPhase === 'loadmodel'
                            ? 'Loading draft model…'
                            : simPhase === 'sim'
                              ? 'Running draft simulation…'
                              : simPhase === 'deckbuild'
                                ? 'Building decks…'
                                : simPhase === 'cluster'
                                  ? 'Clustering decks…'
                                : 'Storing results locally…'}
                      </Text>
                      <Text sm className="text-text-secondary">
                        {overallSimProgress}%
                      </Text>
                    </Flexbox>
                    <div className="w-full bg-bg rounded-full h-2.5 overflow-hidden">
                      <div
                        className={[
                          'h-2.5 rounded-full bg-green-600 transition-all duration-500',
                          simPhase !== 'sim' ? 'animate-pulse' : '',
                        ].join(' ')}
                        style={{ width: `${Math.max(2, overallSimProgress)}%`, opacity: simPhase === 'sim' ? 1 : 0.8 }}
                      />
                    </div>
                  </Flexbox>
                </CardBody>
              </Card>
            )}

            {/* Save success */}
            {status === 'completed' && !isRunning && (
              <Card className="border-green-700">
                <CardBody>
                  <Text sm className="text-text">
                    {storageNotice?.startsWith('Results are shown below')
                      ? 'Simulation complete — results are displayed below.'
                      : 'Simulation complete — results are stored locally in this browser and displayed below.'}
                  </Text>
                </CardBody>
              </Card>
            )}
            {storageNotice && (
              <Card className="border-yellow-700">
                <CardBody>
                  <Text sm className="text-yellow-300">
                    {storageNotice}
                  </Text>
                </CardBody>
              </Card>
            )}

            {/* Error */}
            {status === 'failed' && errorMsg && (
              <Card className="border-red-700">
                <CardBody>
                  <Text sm className="text-red-400">
                    Error: {errorMsg}
                  </Text>
                </CardBody>
              </Card>
            )}
            {loadRunError && (
              <Card className="border-red-700">
                <CardBody>
                  <Text sm className="text-red-400">
                    Failed to load run: {loadRunError}
                  </Text>
                </CardBody>
              </Card>
            )}
            {historyLoadError && (
              <Card className="border-red-700">
                <CardBody>
                  <Text sm className="text-red-400">
                    Failed to load local simulation history: {historyLoadError}
                  </Text>
                </CardBody>
              </Card>
            )}

            {/* Results */}
            {displayRunData && (
              <Flexbox direction="col" gap="6">
                {!currentRunSetup && (
                  <Card className="border-yellow-700">
                    <CardBody>
                      <Text sm className="text-text">
                        This saved run predates exact filter reconstruction. Filtered card stats are approximate, and
                        full pick order may be unavailable.
                      </Text>
                    </CardBody>
                  </Card>
                )}
                {isMobileLayout ? (
                  <DraftSimulatorMobileView
                    overview={resultsOverviewNode}
                    filters={resultsFilterNode}
                    detail={resultsMobileDetailNode}
                    archetypes={resultsMobileArchetypesNode}
                    oovWarning={resultsOovWarningNode}
                    bottom={resultsBottomNode}
                  />
                ) : (
                  <DraftSimulatorDesktopView
                    overview={resultsOverviewNode}
                    map={resultsMapNode}
                    filters={resultsFilterNode}
                    oovWarning={resultsOovWarningNode}
                    bottom={resultsBottomNode}
                  />
                )}
              </Flexbox>
            )}

            {/* Advanced options panel */}
            <Card className="border-border">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bg-active"
                onClick={() => setShowAdvancedOptions((v) => !v)}
              >
                <Text sm semibold>Advanced Options</Text>
                <span className="text-text-secondary text-sm ml-4 flex-shrink-0">{showAdvancedOptions ? '▲' : '▼'}</span>
              </button>
              <Collapse isOpen={showAdvancedOptions}>
                <div className="px-4 pb-4 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-text-secondary" htmlFor="draftSimulatorGpuBatchSize">
                      GPU batch size
                    </label>
                    <Select
                      id="draftSimulatorGpuBatchSize"
                      options={GPU_BATCH_OPTIONS}
                      value={`${gpuBatchSize}`}
                      setValue={(value) => setGpuBatchSize(parseInt(value, 10))}
                      disabled={isRunning}
                    />
                    <p className="text-xs text-text-secondary leading-snug">
                      Controls how many picks the ML model scores in a single GPU call. Higher values run faster on a
                      strong GPU but use more VRAM — if simulation crashes or stalls, try a lower value. The simulator
                      will automatically retry at a lower batch size if it detects an out-of-memory error.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showAdvancedClustering}
                      onChange={(e) => setShowAdvancedClustering(e.target.checked)}
                      className="rounded border-border"
                    />
                    Show advanced clustering options
                  </label>
                </div>
              </Collapse>
            </Card>

            <SimulatorExplainer />
            {displayRunData && (
              <PoolInspectionModal
                isOpen={inspectingPoolIndex !== null}
                setOpen={(open) => { if (!open) setInspectingPoolIndex(null); }}
                pool={inspectingPool}
                deck={inspectingDeck}
                cardMeta={displayRunData.cardMeta}
                runData={displayRunData}
                themes={inspectingThemes}
                archetypeLabel={inspectingPool ? poolArchetypeLabels?.get(inspectingPool.poolIndex) ?? null : null}
                highlightOracle={selectedCard?.oracle_id}
                deckLoading={simPhase === 'deckbuild'}
                themeBreakdown={inspectingThemeBreakdown}
              />
            )}
            <PriorRunDeleteModal
              isOpen={deleteRunModalOpen}
              setOpen={setDeleteRunModalOpen}
              run={runPendingDelete}
              onConfirm={handleDeleteRun}
            />
            <ClearSimulationHistoryModal
              isOpen={clearHistoryModalOpen}
              setOpen={setClearHistoryModalOpen}
              onConfirm={handleClearHistory}
            />
            <LeaveSimulationModal
              isOpen={leaveModalOpen}
              setOpen={(open) => { if (!open) handleCancelLeave(); }}
              onLeave={handleConfirmedLeave}
            />
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
    q: 'How does the simulation work?',
    answer: (
      <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
        <p>
          The simulator runs N complete drafts with M bot seats each. At every pick, CubeCobra's ML draft model
          evaluates the current pack alongside each bot's accumulated pool and selects the card it scores highest.
        </p>
        <p>
          Each bot uses a machine learning model trained on hundreds of thousands of real human draft picks. At each
          pick, the bot encodes its current pool into a 128-dimensional embedding vector that represents the archetype
          and strategy it has been drafting toward. The draft decoder then scores every card in the pack based on how
          well it fits that embedding, and the bot selects the highest-rated card. Because the model learned directly
          from human draft data, it naturally prioritizes synergy and deck cohesion over raw individual card power.
        </p>
        <p>
          The simulation tracks pick rate, average pick position within the pack, wheel count (drafted after the pack
          has gone all the way around the table), and taken-P1P1 rate per card.
        </p>
      </div>
    ),
  },
  {
    q: 'How does it run?',
    answer: (
      <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
        <p>
          Pack generation still starts on the server, because CubeCobra needs the cube, the draft format, and the exact
          initial seat/pack layout. After that setup payload arrives, the expensive simulation work runs in the browser.
        </p>
        <p>
          The draft model and deckbuilder are loaded through TensorFlow.js and executed on the client with the browser
          GPU path. In practice that means your machine does the pick-by-pick inference and deckbuilding locally instead
          of sending every draft step back to the backend.
        </p>
        <p>
          Completed runs are stored locally in IndexedDB, not on CubeCobra&apos;s servers. That keeps the tool
          effectively backend-light after setup while still allowing recent runs to be reopened from this browser.
        </p>
      </div>
    ),
  },
  {
    q: 'How does archetype clustering work?',
    answer: (
      <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
        <p>
          After deckbuilding, each built deck is grouped with similar decks to surface recurring deck families. The
          current flow has four stages:
        </p>
        <ol className="list-decimal list-inside space-y-1.5 ml-2">
          <li>
            <span className="font-medium text-text">ML embeddings</span> — each main deck is encoded into a
            128-dimensional vector by the same neural-network draft model that powers bot picks. These vectors capture
            card synergies and strategic signals learned from real drafts. If the model cannot be used, the system
            falls back to simpler card-presence vectors.
          </li>
          <li>
            <span className="font-medium text-text">k-NN graph</span> — a k-nearest-neighbor graph connects each deck
            to its most similar neighbors using cosine distance. This shared graph drives both clustering and the Draft
            Map layout.
          </li>
          <li>
            <span className="font-medium text-text">Leiden clustering</span> — the simulator treats the k-NN graph as
            a network and finds communities of decks that are denser internally than they are to the rest of the run.
            The two exposed controls are <span className="font-medium text-text">Neighbors (k)</span>, which changes
            graph connectivity, and <span className="font-medium text-text">Resolution</span>, which changes how coarse
            or fine the resulting clusters are.
          </li>
          <li>
            <span className="font-medium text-text">UMAP layout</span> — the k-NN graph is projected to 2D for the
            Draft Map scatter plot. Nearby points share similar deck structure, so clusters appear as visible groups of
            points even though the map itself is only a visualization layer.
          </li>
        </ol>
        <p>
          Each cluster is labeled from the actual decks inside it. CubeCobra compares those decks to a library of known
          archetype embeddings, then combines that archetype signal with the cluster&apos;s real color profile to produce
          names like <span className="font-medium text-text">UR Artifact Midrange</span>.
        </p>
        <p>The current cluster detail panel shows:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>
            <span className="font-medium text-text">Staples</span> — the cards that appear most often across decks in
            that cluster
          </li>
          <li>
            <span className="font-medium text-text">Distinct</span> — cards that are unusually concentrated in that
            cluster relative to the rest of the run
          </li>
          <li>
            <span className="font-medium text-text">Exemplary Deck</span> — a real simulated deck chosen as the best
            representative of that cluster
          </li>
          <li>
            <span className="font-medium text-text">Recommendations</span> — cards suggested by the local recommender
            model using the cluster as the seed set
          </li>
          <li>
            <span className="font-medium text-text">Deck-color share, card types, mana curve, and Elo distribution</span>{' '}
            — summary views over the main decks in that cluster
          </li>
        </ul>
        <p>
          The related <span className="font-medium text-text">Deck Color Distribution</span> view uses the same
          pattern for broader color buckets. Those views are usually noisier than clusters, because a color pair like
          <span className="font-medium text-text"> UG</span> can still contain several different strategies.
        </p>
      </div>
    ),
  },
  {
    q: 'How does deckbuilding work?',
    answer: (
      <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
        <p>
          After simulation finishes, every pool is run through the same automated deckbuilder used at the end of a real
          CubeCobra draft — the exact same logic as bot seats in live play.
        </p>
        <p>The process has three phases:</p>
        <ol className="list-decimal list-inside space-y-1.5 ml-2">
          <li>
            <span className="font-medium text-text">Seed selection</span> — a batch ML call scores roughly 10 "seed"
            cards from the pool that best define the deck's strategic direction. These anchor the build.
          </li>
          <li>
            <span className="font-medium text-text">Iterative filling</span> — the draft model fills remaining spell
            slots one at a time, using the seeded picks as context to maintain strategic coherence up to the configured
            spell count (default 23).
          </li>
          <li>
            <span className="font-medium text-text">Land fill</span> — basic lands from the cube's basics board are
            added to reach the configured land count (default 17). Color ratios follow the main deck's mana
            requirements.
          </li>
        </ol>
        <p>
          The <span className="font-medium text-text">Deck %</span> column in All Card Stats shows what fraction of
          builds that included a card in the pool chose to put it in the main deck — near 100% means it's an
          auto-include whenever drafted; low values indicate it frequently gets relegated to the sideboard.
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
              <Text sm semibold>
                {item.q}
              </Text>
              <span className="text-text-secondary text-sm ml-4 flex-shrink-0">{openIdx === idx ? '▲' : '▼'}</span>
            </button>
            <Collapse isOpen={openIdx === idx}>
              <div className="px-4 pb-4">{item.answer}</div>
            </Collapse>
          </div>
        ))}
      </CardBody>
    </Card>
  );
};

export default RenderToRoot(CubeDraftSimulatorPage);
