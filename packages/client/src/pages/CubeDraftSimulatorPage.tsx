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
import DraftBreakdownDisplay from '../components/draft/DraftBreakdownDisplay';
import ConfirmDeleteModal from '../components/modals/ConfirmDeleteModal';
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
  computeCubeContext,
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
import { COLOR_KEYS, getDeckShareColors, MTG_COLORS, normalizeColorOrder } from '../components/draftSimulator/SimulatorCharts';


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

function getOverallSimProgress(
  simPhase: 'setup' | 'loadmodel' | 'sim' | 'deckbuild' | 'save' | null,
  modelLoadProgress: number,
  simProgress: number,
): number {
  switch (simPhase) {
    case 'setup':
      return 5;
    case 'loadmodel':
      return 5 + Math.round((modelLoadProgress / 100) * 15);
    case 'sim':
      return 20 + Math.round((simProgress / 100) * 70);
    case 'deckbuild':
      return 93;
    case 'save':
      return 98;
    default:
      return 0;
  }
}

const SIM_PREVIEW_CARD_W = 140;
const SIM_CLUSTER_CARD_W = 165;

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)} s`;
}

function getColorProfileCodes(colorPair: string): string[] {
  const letters = colorPair.split('').filter((c) => c in MTG_COLORS && c !== 'C' && c !== 'M');
  return letters.length === 0 ? ['C'] : letters;
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
  const cubeCtx = await computeCubeContext(Object.keys(cardMeta), oracleRemapping);
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
            picks = await localPickBatch(flatPacks, flatPools, oracleRemapping, gpuBatchSize, cubeCtx);
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

const COLOR_KEYS_WITH_C = [...COLOR_KEYS, 'C'] as const;

type PoolViewMode = 'pool' | 'deck' | 'fullPickOrder';
type DeckLocationFilter = 'all' | 'deck' | 'sideboard';

const ArchetypeChart: React.FC<{
  archetypeDistribution: ArchetypeEntry[];
  selectedArchetype: string | null;
  onSelect: (colorPair: string | null) => void;
  topArchetypesByColor?: Map<string, string[]>;
}> = ({ archetypeDistribution, selectedArchetype, onSelect, topArchetypesByColor }) => {
  const maxCount = Math.max(...archetypeDistribution.map((e) => e.count), 1);

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
        <div className="rounded-full overflow-hidden" style={{ height: 10, background: 'rgb(var(--bg-accent) / 1)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: getColorProfileGradient(entry.colorPair),
            }}
          />
        </div>
        {topArchetypesByColor?.get(entry.colorPair)?.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {topArchetypesByColor.get(entry.colorPair)!.map((label) => (
              <span key={label} className="text-xs text-text-secondary bg-bg-accent border border-border/60 rounded px-2 py-1">
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {archetypeDistribution.map(renderEntry)}
    </div>
  );
};

type SortKey = keyof CardStats | 'deckInclusion' | 'openerTakeRate';
const CardStatsTable: React.FC<{
  cardStats: CardStats[];
  cardMeta?: Record<string, CardMeta>;
  onSelectCard: (id: string) => void;
  selectedCardOracles: string[];
  inDeckOracles: Set<string> | null;
  inSideboardOracles: Set<string> | null;
  deckInclusionPct: Map<string, number>;
  visiblePoolCounts: Map<string, number>;
  onPageChange?: () => void;
}> = ({
  cardStats,
  cardMeta: cardMetaProp,
  onSelectCard,
  selectedCardOracles,
  inDeckOracles,
  inSideboardOracles,
  deckInclusionPct,
  visiblePoolCounts,
  onPageChange,
}) => {
  const PAGE_SIZE = 20;
  const defaultSortDir = (key: SortKey): 'asc' | 'desc' =>
    key === 'name' || key === 'avgPickPosition' ? 'asc' : 'desc';
  const [sortKey, setSortKey] = useState<SortKey>('avgPickPosition');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState<DeckLocationFilter>('all');
  const [page, setPage] = useState(1);
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(defaultSortDir(key));
    }
  };
  const filtered = cardStats.filter((c) => {
    if (!c.name.toLowerCase().includes(filter.toLowerCase())) return false;
    if (locationFilter === 'deck' && inDeckOracles && !inDeckOracles.has(c.oracle_id)) return false;
    if (locationFilter === 'sideboard' && inSideboardOracles && !inSideboardOracles.has(c.oracle_id)) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    let av: number | string, bv: number | string;
    if (sortKey === 'deckInclusion') {
      av = deckInclusionPct.get(a.oracle_id) ?? 0;
      bv = deckInclusionPct.get(b.oracle_id) ?? 0;
    } else if (sortKey === 'openerTakeRate') {
      av = a.p1p1Seen > 0 ? a.p1p1Count / a.p1p1Seen : 0;
      bv = b.p1p1Seen > 0 ? b.p1p1Count / b.p1p1Seen : 0;
    } else if (sortKey === 'avgPickPosition') {
      av = a.avgPickPosition > 0 ? a.avgPickPosition : Number.POSITIVE_INFINITY;
      bv = b.avgPickPosition > 0 ? b.avgPickPosition : Number.POSITIVE_INFINITY;
    } else {
      av = a[sortKey] as number | string;
      bv = b[sortKey] as number | string;
    }
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
  const numericSortCols = new Set<SortKey>([
    'elo',
    'timesSeen',
    'timesPicked',
    'pickRate',
    'avgPickPosition',
    'wheelCount',
    'p1p1Count',
    'p1p1Seen',
    'deckInclusion',
    'openerTakeRate',
  ]);
  const renderSortHeader = (label: string, col: SortKey, tooltip?: string) => (
    <th
      className={[
        'px-3 py-2 text-xs font-medium uppercase tracking-wider whitespace-nowrap',
        numericSortCols.has(col) ? 'text-right' : 'text-left',
      ].join(' ')}
      aria-sort={sortKey === col ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      scope="col"
    >
      <button
        type="button"
        className={[
          'w-full select-none rounded px-1 py-0.5 hover:bg-bg-active focus:outline-none focus:ring-2 focus:ring-link',
          numericSortCols.has(col) ? 'text-right' : 'text-left',
        ].join(' ')}
        title={tooltip}
        aria-label={tooltip ? `${label}. ${tooltip}` : `Sort by ${label}`}
        onClick={() => handleSort(col)}
      >
        {label}
        {tooltip ? ' ?' : ''}
        {sortKey === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );
  return (
    <Flexbox direction="col" gap="2">
      <Flexbox direction="row" gap="3" alignItems="center" className="flex-wrap">
        <div className="relative max-w-xs flex items-center">
          <Input
            type="text"
            placeholder="Filter by card name…"
            value={filter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
            className="w-full pr-7"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter('')}
              aria-label="Clear card name filter"
              className="absolute right-2 text-text-secondary hover:text-text text-sm leading-none"
            >
              ✕
            </button>
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
                  locationFilter === v
                    ? 'bg-link text-white border-link'
                    : 'bg-bg text-text-secondary border-border hover:bg-bg-active',
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
          <thead className="bg-bg-accent">
            <tr>
              {renderSortHeader('Card', 'name')}
              {renderSortHeader('Elo', 'elo')}
              {renderSortHeader('Seen', 'timesSeen', 'Times this card appeared in a live pack during the draft')}
              {renderSortHeader('Picked', 'timesPicked')}
              {renderSortHeader('Pick Rate', 'pickRate', 'When this card was seen in a pack, how often it was drafted')}
              {renderSortHeader('Avg Pick', 'avgPickPosition')}
              {renderSortHeader(
                'Wheels',
                'wheelCount',
                'Times this card was drafted after the pack went all the way around the table (position > seats)',
              )}
              {renderSortHeader('P1P1', 'p1p1Count', 'Times this card was taken as the very first pick of pack 1')}
              {renderSortHeader(
                'Taken P1P1 %',
                'openerTakeRate',
                'Of opening packs in pack 1 that contained this card, how often it was the pick',
              )}
              {renderSortHeader(
                'Deck %',
                'deckInclusion',
                'Of decks that drafted this card, how often it made the main deck vs. sideboard',
              )}
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider">Filter</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pagedRows.map((c) => {
              const inclPct = deckInclusionPct.get(c.oracle_id);
              const isFilteredCard = selectedCardOracles.includes(c.oracle_id);
              const visiblePoolCount = visiblePoolCounts.get(c.oracle_id) ?? c.poolIndices.length;
              const openerTakeRate = c.p1p1Seen > 0 ? c.p1p1Count / c.p1p1Seen : 0;
              return (
                <tr
                  key={c.oracle_id}
                  className={isFilteredCard ? 'bg-bg-active' : 'hover:bg-bg-active'}
                >
                  <td className="px-3 py-2 font-medium">{renderAutocardNameLink(c.oracle_id, c.name, cardMetaProp?.[c.oracle_id]?.imageUrl)}</td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">{Math.round(c.elo)}</td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">{c.timesSeen}</td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">{c.timesPicked}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {(c.pickRate * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">
                    {c.avgPickPosition > 0 ? c.avgPickPosition.toFixed(1) : '—'}
                  </td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">{c.wheelCount}</td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">{c.p1p1Count}</td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">
                    {c.p1p1Seen > 0 ? `${(openerTakeRate * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">
                    {inclPct !== undefined ? `${(inclPct * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className={[
                        'px-2 py-0.5 rounded text-xs font-medium border',
                        isFilteredCard
                          ? 'bg-link text-white border-link'
                          : 'bg-link/10 text-link border-link/30 hover:bg-link/20',
                      ].join(' ')}
                      onClick={() => onSelectCard(c.oracle_id)}
                    >
                      {isFilteredCard ? (
                        <>
                          ✕ <span className="tabular-nums">{visiblePoolCount}</span>
                        </>
                      ) : (
                        <span className="tabular-nums">{visiblePoolCount}</span>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Flexbox direction="row" justify="between" alignItems="center" className="flex-wrap gap-2 pt-1">
        <Text xs className="text-text-secondary">
          Page {currentPage} / {totalPages}
        </Text>
        <Flexbox direction="row" gap="2" alignItems="center">
          <button
            type="button"
            onClick={() => {
              setPage((p) => Math.max(1, p - 1));
              onPageChange?.();
            }}
            disabled={currentPage === 1}
            className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => {
              setPage((p) => Math.min(totalPages, p + 1));
              onPageChange?.();
            }}
            disabled={currentPage === totalPages}
            className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

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
  const [selectedDeckCardOracles, setSelectedDeckCardOracles] = useState<string[]>([]);
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
    setSelectedDeckCardOracles([]);
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
    loadingRun,
    historyLoadError,
    loadRunError,
    storageNotice,
    setCurrentRunSetup,
    setStorageNotice,
    handleLoadRun,
    handleDeleteRun,
    handleClearHistory,
    handlePersistCompletedRun,
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
    onPersistCompletedRun: handlePersistCompletedRun,
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
      selectedDeckCardOracles,
      selectedSkeletonId,
      selectedArchetype,
      focusedPoolIndex,
      focusedPoolViewMode,
    }),
    [selectedCardOracles, selectedDeckCardOracles, selectedSkeletonId, selectedArchetype, focusedPoolIndex, focusedPoolViewMode],
  );
  const selectionSetters = useMemo<DraftSimulatorSelectionSetters>(
    () => ({
      setSelectedCardOracles,
      setSelectedDeckCardOracles,
      setSelectedArchetype,
      setSelectedSkeletonId,
      setFocusedPoolIndex,
    }),
    [setSelectedCardOracles, setSelectedDeckCardOracles, setSelectedArchetype, setSelectedSkeletonId, setFocusedPoolIndex],
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
    selectedDeckCards,
    selectedCard,
    activeFilterPoolIndexSet,
    filteredDecks,
    deckInclusionPct,
    deckCardPoolIndices,
    visibleDeckCounts,
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
    selectedDeckCards,
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

  const handleToggleSelectedDeckCard = useCallback((oracleId: string) => {
    setSelectedDeckCardOracles((current) => {
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

  // Derived values needed by DraftMapCard for the color-profile panel
  const selectedColorPoolIndices = useMemo<number[]>(
    () =>
      selectedArchetype
        ? displayedPools.filter((p) => p.archetype === selectedArchetype).map((p) => p.poolIndex)
        : [],
    [selectedArchetype, displayedPools],
  );
  const selectedColorDeckBuilds = useMemo<BuiltDeck[] | null>(
    () =>
      activeDecks && selectedColorPoolIndices.length > 0
        ? selectedColorPoolIndices.map((i) => activeDecks[i]).filter((d): d is BuiltDeck => !!d)
        : null,
    [activeDecks, selectedColorPoolIndices],
  );

  // Node variables passed as slot props to layout components
  const resultsOverviewNode: React.ReactNode = displayRunData ? (
    <DraftSimulatorOverviewSection
      displayRunData={displayRunData}
      activeDecks={activeDecks}
      overviewOpen={overviewOpen}
      setOverviewOpen={setOverviewOpen}
      mobileLayout={isMobileLayout}
    />
  ) : null;

  const resultsFilterNode: React.ReactNode = displayRunData ? (
    <DraftSimulatorFilterBar
      chips={filterChipItems}
      matchingPools={activeFilterPoolIndexSet?.size ?? displayedPools.length}
      totalPools={displayedPools.length}
      cardStats={displayRunData.cardStats}
      selectedCardOracles={selectedCardOracles}
      archetypeDistribution={displayedArchetypeDistribution}
      selectedArchetype={selectedArchetype}
      skeletons={skeletons}
      selectedSkeletonId={selectedSkeletonId}
      onAddCard={handleToggleSelectedCard}
      onAddDeckCard={handleToggleSelectedDeckCard}
      onSelectArchetype={setSelectedArchetype}
      onSelectSkeleton={setSelectedSkeletonId}
      onClearAll={clearActiveFilter}
      renderArchetypeLabel={(colorPair) => archetypeFullName(colorPair)}
      renderSkeletonLabel={(skeleton) => getSkeletonDisplayName(skeleton, poolArchetypeLabels, skeletonColorProfiles)}
    />
  ) : null;

  const resultsMapNode: React.ReactNode = displayRunData ? (
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
      selectedDeckCards={selectedDeckCards}
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
      onClearSelectedDeckCards={() => setSelectedDeckCardOracles([])}
      cubeOracleSet={cubeOracleSet}
      excludeManaFixingLands={excludeManaFixingLands}
      setExcludeManaFixingLands={setExcludeManaFixingLands}
      onInspectPool={setInspectingPoolIndex}
      selectedArchetype={selectedArchetype}
      selectedColorPoolIndices={selectedColorPoolIndices}
      selectedColorDeckBuilds={selectedColorDeckBuilds}
      onToggleSelectedCard={handleToggleSelectedCard}
    />
  ) : null;

  const resultsMobileDetailNode: React.ReactNode = (() => {
    if (!displayRunData || selectedSkeletonId === null) return null;
    const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
    if (!sk) return null;
    const skIdx = skeletons.indexOf(sk);
    const clusterDecks = activeDecks ? sk.poolIndices.map((i) => activeDecks[i]).filter((d): d is BuiltDeck => !!d) : null;
    return (
      <ClusterDetailPanel
        skeleton={sk}
        clusterIndex={skIdx}
        totalPools={displayRunData.slimPools.length}
        clusterDeckBuilds={clusterDecks}
        cubeOracleSet={cubeOracleSet}
        cardMeta={displayRunData.cardMeta}
        slimPools={displayRunData.slimPools}
        deckBuilds={activeDecks}
        themes={clusterThemesByClusterId.get(sk.clusterId)}
        poolArchetypeLabels={poolArchetypeLabels}
        excludeManaFixingLands={excludeManaFixingLands}
        setExcludeManaFixingLands={setExcludeManaFixingLands}
        onOpenPool={setInspectingPoolIndex}
        onClose={() => {
          setSelectedSkeletonId(null);
          setFocusedPoolIndex(null);
        }}
      />
    );
  })();

  // Archetypes are now handled as a tab inside DraftSimulatorBottomSection on both mobile and desktop
  const resultsMobileArchetypesNode: React.ReactNode = null;

  const resultsOovWarningNode: React.ReactNode =
    oovWarningPct != null && oovWarningPct > 0.05 ? (
      <Card className="border-yellow-700">
        <CardBody>
          <Text sm className="text-yellow-300">
            {`${(oovWarningPct * 100).toFixed(0)}% of drafts had cards outside the embedding vocabulary. Clustering and archetype labels may be less accurate for those pools.`}
          </Text>
        </CardBody>
      </Card>
    ) : null;

  const resultsBottomNode: React.ReactNode = displayRunData ? (
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
      handleToggleSelectedDeckCard={handleToggleSelectedDeckCard}
      selectedDeckCardOracles={selectedDeckCardOracles}
      deckCardPoolIndices={deckCardPoolIndices}
      visibleDeckCounts={visibleDeckCounts}
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
                    <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2">
                      {runs.map((run) => (
                        <div
                          key={run.entry.ts}
                          className={[
                            'group relative flex flex-col cursor-pointer transition-colors select-none rounded-md border overflow-hidden',
                            run.entry.ts === selectedTs
                              ? 'border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-800 shadow-[inset_3px_0_0_rgb(59_130_246)]'
                              : 'border-border bg-bg-accent hover:bg-bg-active',
                          ].join(' ')}
                          style={{ minWidth: isMobileLayout ? undefined : 160, padding: '8px 28px 8px 13px' }}
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
          pick, the bot encodes its current pool into a 128-dimensional embedding that represents the archetype and
          strategy it has been drafting toward. That pool embedding is combined with a 32-dimensional cube-context
          vector — a summary of the cube's overall card composition — to form a 160-dimensional input to the draft
          decoder, which scores every card in the pack and selects the highest-rated one. Because the model learned
          directly from human draft data, it naturally prioritizes synergy and deck cohesion over raw individual card
          power.
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
