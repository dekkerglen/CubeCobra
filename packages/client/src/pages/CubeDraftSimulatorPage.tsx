/* eslint-disable camelcase, no-plusplus, no-restricted-syntax */
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type CardType from '@utils/datatypes/Card';
import type { CardDetails } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import {
  ArchetypeEntry,
  ArchetypeSkeleton,
  BuiltDeck,
  CardMeta,
  CardStats,
  LockPair,
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
import { DeckStacksStatic } from '../components/DeckCard';
import ArchetypeChart from '../components/draftSimulator/ArchetypeChart';
import CardStatsTable from '../components/draftSimulator/CardStatsTable';
import DraftSimulatorFilterBar, { type FilterChipItem } from '../components/draftSimulator/DraftSimulatorFilterBar';
import DraftMapScatter, { type DraftMapColorMode, type DraftMapPoint } from '../components/draftSimulator/DraftMapScatter';
import DraftVsEloTable from '../components/draftSimulator/DraftVsEloTable';
import {
  ClearSimulationHistoryModal,
  LeaveSimulationModal,
  PriorRunDeleteModal,
} from '../components/draftSimulator/DraftSimulatorModals';
import DraftBreakdownDisplay from '../components/draft/DraftBreakdownDisplay';
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
import { modelScoresToProbabilities } from '../utils/botRatings';
import {
  buildOracleRemapping,
  DeckbuildEntry,
  loadDraftBot,
  loadDraftRecommender,
  localBatchDeckbuild,
  localBatchDraftRanked,
  localPickBatch,
  localRecommend,
  WebGLInferenceError,
} from '../utils/draftBot';
import {
  archetypeFullName,
  computeClusterThemes,
  extractThemeFeatures,
  formatClusterThemeLabels,
  formatFeatureKey,
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const OverviewChartSpinner: React.FC = () => (
  <div className="flex items-center justify-center" style={{ minHeight: 120 }}>
    <svg className="animate-spin h-6 w-6 text-text-secondary/40" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  </div>
);

const SummaryCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  onClick?: () => void;
  badge?: React.ReactNode;
}> = ({ label, value, sub, onClick, badge }) => (
  <div className="flex-1 min-w-[180px]">
    <Card className={onClick ? 'h-full transition-colors hover:bg-bg-active' : 'h-full'}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="block h-full w-full text-inherit text-left focus:outline-none focus:ring-2 focus:ring-link focus:ring-inset rounded"
          aria-label={`${label}: ${value}. ${sub ?? 'Open details.'}`}
        >
          <CardBody className="text-center py-5">
            <div className="text-4xl font-bold mb-2">{value}</div>
            <div>
              <Text md semibold>
                {label}
              </Text>
            </div>
            {sub && (
              <div className="mt-1">
                <Text xs className="text-text-secondary">
                  {sub}
                </Text>
              </div>
            )}
            {badge && <div className="mt-2">{badge}</div>}
          </CardBody>
        </button>
      ) : (
        <CardBody className="text-center py-5">
          <div className="text-4xl font-bold mb-2">{value}</div>
          <div>
            <Text md semibold>
              {label}
            </Text>
          </div>
          {sub && (
            <div className="mt-1">
              <Text xs className="text-text-secondary">
                {sub}
              </Text>
            </div>
          )}
          {badge && <div className="mt-2">{badge}</div>}
        </CardBody>
      )}
    </Card>
  </div>
);

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

function computeDraftMapPoints(
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

const PickCard: React.FC<{ pick: SimulatedPickCard; isSelected: boolean }> = React.memo(({ pick, isSelected }) => (
  <div
    className={[
      'relative rounded border overflow-hidden bg-bg flex-shrink-0',
      isSelected ? 'border-link-active ring-2 ring-link-active' : 'border-border',
    ].join(' ')}
    style={{ width: SIM_PREVIEW_CARD_W }}
  >
    {pick.imageUrl ? (
      <img src={pick.imageUrl} alt={pick.name} className="w-full block" />
    ) : (
      <div
        className="w-full flex items-center justify-center p-1 text-xs text-text-secondary"
        style={{ height: Math.round(SIM_PREVIEW_CARD_W * 1.4) }}
      >
        {pick.name || 'Unknown'}
      </div>
    )}
    <div className="absolute top-1 left-1 bg-black/80 text-white text-[10px] font-bold rounded px-1 leading-tight">
      P{pick.packNumber + 1}P{pick.pickNumber}
    </div>
  </div>
));

type PoolViewMode = 'pool' | 'deck' | 'fullPickOrder';
type DeckLocationFilter = 'all' | 'deck' | 'sideboard';
type SimulatorBreakdownPick = { cardIndex: number };
type SimulatorBreakdownState = {
  packNumber: number;
  pickNumber: number;
  cardsInPack: SimulatorBreakdownPick[];
  actualPickIndex: number;
  packOracleIds: string[];
  previousPickOracleIds: string[];
};

function simulatorCardFromMeta(oracleId: string, meta?: CardMeta): CardType {
  const name = meta?.name ?? oracleId;
  return {
    cardID: oracleId,
    imgUrl: meta?.imageUrl,
    details: {
      oracle_id: oracleId,
      scryfall_id: oracleId,
      name,
      full_name: name,
      name_lower: name.toLowerCase(),
      image_normal: meta?.imageUrl,
      cmc: meta?.cmc ?? 0,
      type: meta?.type ?? '',
      color_identity: meta?.colorIdentity ?? [],
      colors: meta?.colorIdentity ?? [],
    } as CardDetails,
  };
}

function buildSimulatorDraftBreakdown(
  pool: SimulatedPool,
  runData: SimulationRunData,
): { cards: CardType[]; picksList: SimulatorBreakdownPick[][]; states: SimulatorBreakdownState[] } | null {
  const setup = runData.setupData;
  if (!setup) return null;

  const { initialPacks, packSteps, numSeats } = setup;
  const draftIndex = pool.draftIndex;
  const targetPoolIndex = pool.poolIndex;
  const cardIndexByOracle = new Map<string, number>();
  const cards: CardType[] = [];
  const getCardIndex = (oracleId: string): number => {
    const existing = cardIndexByOracle.get(oracleId);
    if (existing !== undefined) return existing;
    const nextIndex = cards.length;
    cardIndexByOracle.set(oracleId, nextIndex);
    cards.push(simulatorCardFromMeta(oracleId, runData.cardMeta[oracleId]));
    return nextIndex;
  };

  const orderedPicksByPool = runData.slimPools.map((slim) =>
    [...slim.picks].sort((a, b) => a.packNumber - b.packNumber || a.pickNumber - b.pickNumber),
  );
  const pickPointers = new Array<number>(runData.slimPools.length).fill(0);
  const randomTrashPointers = new Array<number>(runData.slimPools.length).fill(0);
  const currentPacks: string[][] = Array.from({ length: numSeats }, (_, seatIndex) => [
    ...(initialPacks[draftIndex]?.[seatIndex]?.[0] ?? []),
  ]);
  const picksList: SimulatorBreakdownPick[][] = Array.from({ length: packSteps.length }, () => []);
  const states: SimulatorBreakdownState[] = [];
  const previousPickOracleIds: string[] = [];

  for (let packNum = 0; packNum < packSteps.length; packNum++) {
    if (packNum > 0) {
      for (let seatIndex = 0; seatIndex < numSeats; seatIndex++) {
        currentPacks[seatIndex] = [...(initialPacks[draftIndex]?.[seatIndex]?.[packNum] ?? [])];
      }
    }

    const steps = packSteps[packNum] ?? [];
    let pickNumInPack = 1;

    for (const step of steps) {
      if (step.action === 'pick' || step.action === 'pickrandom') {
        const numPicks = step.amount ?? 1;
        for (let pickStep = 0; pickStep < numPicks; pickStep++) {
          for (let seatIndex = 0; seatIndex < numSeats; seatIndex++) {
            const poolIndex = draftIndex * numSeats + seatIndex;
            const pack = currentPacks[seatIndex] ?? [];
            const nextPick = orderedPicksByPool[poolIndex]?.[pickPointers[poolIndex] ?? 0];
            if (!nextPick) continue;

            if (poolIndex === targetPoolIndex) {
              const packOracleIds = [...pack];
              const cardsInPack = packOracleIds.map((oracleId) => ({ cardIndex: getCardIndex(oracleId) }));
              const actualPickIndex = packOracleIds.findIndex((oracleId) => oracleId === nextPick.oracle_id);
              picksList[packNum]!.push({ cardIndex: getCardIndex(nextPick.oracle_id) });
              states.push({
                packNumber: packNum,
                pickNumber: pickNumInPack,
                cardsInPack,
                actualPickIndex,
                packOracleIds,
                previousPickOracleIds: [...previousPickOracleIds],
              });
              previousPickOracleIds.push(nextPick.oracle_id);
            }

            pickPointers[poolIndex] = (pickPointers[poolIndex] ?? 0) + 1;
            const removeIdx = pack.indexOf(nextPick.oracle_id);
            if (removeIdx >= 0) pack.splice(removeIdx, 1);
          }
          pickNumInPack++;
        }
      } else if (step.action === 'trash' || step.action === 'trashrandom') {
        const numTrash = step.amount ?? 1;
        for (let trashStep = 0; trashStep < numTrash; trashStep++) {
          for (let seatIndex = 0; seatIndex < numSeats; seatIndex++) {
            const poolIndex = draftIndex * numSeats + seatIndex;
            const pack = currentPacks[seatIndex] ?? [];
            if (pack.length === 0) continue;
            if (step.action === 'trashrandom') {
              const trashed = runData.randomTrashByPool?.[poolIndex]?.[randomTrashPointers[poolIndex] ?? 0];
              randomTrashPointers[poolIndex] = (randomTrashPointers[poolIndex] ?? 0) + 1;
              const removeIdx = trashed ? pack.indexOf(trashed) : -1;
              if (removeIdx >= 0) pack.splice(removeIdx, 1);
            } else {
              pack.shift();
            }
          }
          pickNumInPack++;
        }
      } else if (step.action === 'pass') {
        const direction = packNum % 2 === 0 ? 1 : -1;
        const snapshot = currentPacks.map((pack) => [...pack]);
        for (let seatIndex = 0; seatIndex < numSeats; seatIndex++) {
          currentPacks[(seatIndex + direction + numSeats) % numSeats] = snapshot[seatIndex]!;
        }
      }
    }
  }

  return { cards, picksList, states };
}

function reconstructSimulatorPoolFromRun(runData: SimulationRunData, poolIndex: number): SimulatedPool | null {
  const slim = runData.slimPools[poolIndex];
  if (!slim) return null;
  return {
    poolIndex,
    draftIndex: slim.draftIndex,
    seatIndex: slim.seatIndex,
    archetype: slim.archetype,
    picks: slim.picks.map((pick) => {
      const meta = runData.cardMeta[pick.oracle_id];
      return {
        oracle_id: pick.oracle_id,
        name: meta?.name ?? pick.oracle_id,
        imageUrl: meta?.imageUrl ?? '',
        packNumber: pick.packNumber,
        pickNumber: pick.pickNumber,
      };
    }),
  };
}

const SimulatorPickBreakdown: React.FC<{ pool: SimulatedPool; runData: SimulationRunData }> = ({ pool, runData }) => {
  const [pickNumber, setPickNumber] = useState('0');
  const [selectedSeatIndex, setSelectedSeatIndex] = useState(pool.seatIndex);
  const [showRatings, setShowRatings] = useState(true);
  const [ratings, setRatings] = useState<number[]>([]);
  const seatPools = useMemo(
    () =>
      runData.slimPools
        .map((slim, poolIndex) => ({ poolIndex, draftIndex: slim.draftIndex, seatIndex: slim.seatIndex }))
        .filter((candidate) => candidate.draftIndex === pool.draftIndex)
        .sort((a, b) => a.seatIndex - b.seatIndex),
    [pool.draftIndex, runData.slimPools],
  );
  const activePool = useMemo(() => {
    const selectedSeatPool = seatPools.find((candidate) => candidate.seatIndex === selectedSeatIndex);
    return selectedSeatPool ? reconstructSimulatorPoolFromRun(runData, selectedSeatPool.poolIndex) : pool;
  }, [pool, runData, seatPools, selectedSeatIndex]);
  const breakdown = useMemo(
    () => (activePool ? buildSimulatorDraftBreakdown(activePool, runData) : null),
    [activePool, runData],
  );
  const currentPickNumber = Math.min(
    Math.max(parseInt(pickNumber, 10) || 0, 0),
    Math.max(0, (breakdown?.states.length ?? 1) - 1),
  );
  const current = breakdown?.states[currentPickNumber];

  useEffect(() => {
    setSelectedSeatIndex(pool.seatIndex);
    setPickNumber('0');
    setRatings([]);
  }, [pool.poolIndex, pool.seatIndex]);

  useEffect(() => {
    if (!breakdown) return undefined;
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && currentPickNumber > 0) {
        setPickNumber((currentPickNumber - 1).toString());
      } else if (event.key === 'ArrowRight' && currentPickNumber < breakdown.states.length - 1) {
        setPickNumber((currentPickNumber + 1).toString());
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [breakdown, currentPickNumber]);

  useEffect(() => {
    let cancelled = false;
    if (!showRatings || !current || current.packOracleIds.length === 0) {
      setRatings([]);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        await loadDraftBot();
        const ranked = await localBatchDraftRanked(
          [{ pack: current.packOracleIds, pool: current.previousPickOracleIds }],
          buildOracleRemapping(runData.cardMeta),
        );
        if (cancelled) return;
        const rawByOracle = new Map((ranked[0] ?? []).map((entry) => [entry.oracle, entry.rating]));
        setRatings(modelScoresToProbabilities(current.packOracleIds.map((oracleId) => rawByOracle.get(oracleId) ?? 0)));
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load simulator pick recommendations:', err);
          setRatings([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [current, runData.cardMeta, showRatings]);

  if (!breakdown || !current) {
    return (
      <div className="p-3">
        <Text sm className="text-text-secondary">
          Full pick order is unavailable for this run.
        </Text>
      </div>
    );
  }

  const onPickClick = (packIndex: number, pickIndex: number) => {
    let picks = 0;
    for (let i = 0; i < packIndex; i++) picks += breakdown.picksList[i]?.length ?? 0;
    setPickNumber((picks + pickIndex).toString());
  };
  const selectedSeatPoolIndex = seatPools.findIndex((candidate) => candidate.seatIndex === selectedSeatIndex);
  const goToRelativeSeat = (delta: number) => {
    if (seatPools.length === 0) return;
    const currentIndex = selectedSeatPoolIndex >= 0 ? selectedSeatPoolIndex : 0;
    const next = seatPools[(currentIndex + delta + seatPools.length) % seatPools.length];
    if (next) setSelectedSeatIndex(next.seatIndex);
  };

  return (
    <div className="p-3">
      <Flexbox
        direction="row"
        justify="between"
        alignItems="center"
        className="mb-3 flex-wrap gap-2 rounded border border-border bg-bg-accent/50 px-3 py-2"
      >
        <Text sm semibold>
          Draft {pool.draftIndex + 1} · Seat {selectedSeatIndex + 1}
        </Text>
        <Flexbox direction="row" gap="1" className="flex-wrap">
          <button
            type="button"
            onClick={() => goToRelativeSeat(-1)}
            className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active"
          >
            Previous seat
          </button>
          {seatPools.map((seatPool) => (
            <button
              key={seatPool.poolIndex}
              type="button"
              onClick={() => setSelectedSeatIndex(seatPool.seatIndex)}
              className={[
                'px-2 py-0.5 rounded text-xs font-medium border',
                selectedSeatIndex === seatPool.seatIndex
                  ? 'bg-link text-white border-link'
                  : 'bg-bg text-text-secondary border-border hover:bg-bg-active',
              ].join(' ')}
            >
              Seat {seatPool.seatIndex + 1}
            </button>
          ))}
          <button
            type="button"
            onClick={() => goToRelativeSeat(1)}
            className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active"
          >
            Next seat
          </button>
        </Flexbox>
      </Flexbox>
      <DraftBreakdownDisplay
        showRatings={showRatings}
        setShowRatings={setShowRatings}
        packNumber={current.packNumber}
        pickNumber={current.pickNumber}
        cardsInPack={current.cardsInPack}
        picksList={breakdown.picksList}
        ratings={showRatings ? ratings : undefined}
        actualPickIndex={current.actualPickIndex}
        cards={breakdown.cards}
        onPickClick={onPickClick}
        cardUrlPrefix="/tool/card"
        hideRatingsToggle
        hideHelpText
      />
    </div>
  );
};

const ViewToggle: React.FC<{
  mode: PoolViewMode;
  onChange: (m: PoolViewMode) => void;
  hasDeck: boolean;
  hasFullPickOrder: boolean;
  deckLoading?: boolean;
}> = ({ mode, onChange, hasDeck, hasFullPickOrder, deckLoading }) => (
  <Flexbox direction="row" gap="1">
    {(['deck', 'pool', 'fullPickOrder'] as const).map((m) => (
      <button
        key={m}
        type="button"
        disabled={(m === 'deck' && !hasDeck) || (m === 'fullPickOrder' && !hasFullPickOrder)}
        onClick={() => onChange(m)}
        className={[
          'px-2 py-0.5 rounded text-xs font-medium border',
          mode === m ? 'bg-link text-white border-link' : 'bg-bg text-text-secondary border-border hover:bg-bg-active',
          (m === 'deck' && !hasDeck) || (m === 'fullPickOrder' && !hasFullPickOrder)
            ? 'opacity-40 cursor-not-allowed'
            : '',
        ].join(' ')}
      >
        {m === 'deck' ? (deckLoading ? 'Building…' : 'Deck') : m === 'pool' ? 'Pick Order' : 'Full pick order'}
      </button>
    ))}
  </Flexbox>
);

const CMC_COLS = 8;

/** Build piles + a minimal cards array compatible with DeckStacksStatic from oracle ID lists.
 *  Rows: 0 = Creatures, 1 = Non-Creatures, 2 = Lands. Columns: CMC 0–7+. */
function buildPilesFromOracles(
  oracleIds: string[],
  cardMeta: Record<string, CardMeta>,
): { piles: number[][][]; cards: { cardID: string; details: { oracle_id: string; name: string; image_normal: string } }[] } {
  const cards: { cardID: string; details: { oracle_id: string; name: string; image_normal: string } }[] = [];
  const oracleToIndex: Record<string, number> = {};
  for (const id of oracleIds) {
    if (oracleToIndex[id] !== undefined) continue;
    const meta = cardMeta[id];
    oracleToIndex[id] = cards.length;
    cards.push({ cardID: id, details: { oracle_id: id, name: meta?.name ?? id, image_normal: meta?.imageUrl ?? '' } });
  }

  const piles: number[][][] = Array.from({ length: 3 }, () =>
    Array.from({ length: CMC_COLS }, () => [] as number[]),
  );

  for (const id of oracleIds) {
    const meta = cardMeta[id];
    const typeLower = (meta?.type ?? '').toLowerCase();
    const row = typeLower.includes('land') ? 2 : typeLower.includes('creature') ? 0 : 1;
    const col = Math.min(CMC_COLS - 1, Math.max(0, Math.floor(meta?.cmc ?? 0)));
    piles[row]![col]!.push(oracleToIndex[id]!);
  }

  const nonEmptyPiles = piles.filter((row) => row.some((col) => col.length > 0));
  return { piles: nonEmptyPiles, cards };
}

const SimDeckView: React.FC<{
  deck: BuiltDeck;
  cardMeta: Record<string, CardMeta>;
}> = ({ deck, cardMeta }) => {
  const { piles: mainPiles, cards } = useMemo(
    () => buildPilesFromOracles(deck.mainboard, cardMeta),
    [deck.mainboard, cardMeta],
  );
  const { piles: sbPiles, cards: sbCards } = useMemo(
    () => buildPilesFromOracles(deck.sideboard, cardMeta),
    [deck.sideboard, cardMeta],
  );

  return (
    <div className="overflow-x-auto">
      <DeckStacksStatic piles={mainPiles} cards={cards} />
      {deck.sideboard.length > 0 && (
        <>
          <div className="px-3 py-2 border-t border-border">
            <Text semibold lg>
              Sideboard ({deck.sideboard.length})
            </Text>
          </div>
          <DeckStacksStatic piles={sbPiles} cards={sbCards} />
        </>
      )}
    </div>
  );
};

const PoolExpansionContent: React.FC<{
  pool: SimulatedPool;
  mode: PoolViewMode;
  deck: BuiltDeck | null;
  cardMeta: Record<string, CardMeta>;
  runData: SimulationRunData;
  highlightOracle?: string;
}> = ({ pool, mode, deck, cardMeta, runData, highlightOracle }) => {
  if (mode === 'deck' && deck && (deck.mainboard.length > 0 || deck.sideboard.length > 0)) {
    return <SimDeckView deck={deck} cardMeta={cardMeta} />;
  }
  if (mode === 'fullPickOrder') {
    return <SimulatorPickBreakdown pool={pool} runData={runData} />;
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
              <Text xs className="text-text-secondary mb-1 font-semibold uppercase tracking-wider">
                Pack {packNum + 1}
              </Text>
              <div className="flex flex-row gap-1.5 flex-wrap">
                {packPicks.map((pick) => (
                  <PickCard
                    key={`${pick.packNumber}-${pick.pickNumber}`}
                    pick={pick}
                    isSelected={pick.oracle_id === highlightOracle}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </Flexbox>
    </div>
  );
};

type DraftBreakdownSortKey = 'draft' | 'seat' | 'color' | 'creatures' | 'avgMv';

interface DraftBreakdownRowSummary {
  pool: SimulatedPool;
  deck: BuiltDeck | null;
  colors: string;
  themes: string[];
  highlights: SimulatedPickCard[];
  creatureCount: number;
  nonCreatureCount: number;
  landCount: number;
  creatureCurveCounts: number[];
  nonCreatureCurveCounts: number[];
  avgMv: number;
}

function getDraftComposition(
  pool: SimulatedPool,
  deck: BuiltDeck | null,
  cardMeta: Record<string, CardMeta>,
): Pick<
  DraftBreakdownRowSummary,
  'creatureCount' | 'nonCreatureCount' | 'landCount' | 'creatureCurveCounts' | 'nonCreatureCurveCounts' | 'avgMv'
> {
  const creatureCurveCounts = Array.from({ length: CMC_COLS }, () => 0);
  const nonCreatureCurveCounts = Array.from({ length: CMC_COLS }, () => 0);
  let creatureCount = 0;
  let nonCreatureCount = 0;
  let landCount = 0;
  let totalMv = 0;
  let mvCount = 0;

  for (const oracleId of getPoolMainCards(pool, deck, cardMeta)) {
    const meta = cardMeta[oracleId];
    const typeLower = (meta?.type ?? '').toLowerCase();
    if (typeLower.includes('land')) {
      landCount++;
      continue;
    }

    const cmc = Math.max(0, Math.floor(meta?.cmc ?? 0));
    const bucket = Math.min(CMC_COLS - 1, cmc);
    if (typeLower.includes('creature')) {
      creatureCount++;
      creatureCurveCounts[bucket]!++;
    } else {
      nonCreatureCount++;
      nonCreatureCurveCounts[bucket]!++;
    }
    totalMv += meta?.cmc ?? 0;
    mvCount++;
  }

  return {
    creatureCount,
    nonCreatureCount,
    landCount,
    creatureCurveCounts,
    nonCreatureCurveCounts,
    avgMv: mvCount > 0 ? totalMv / mvCount : 0,
  };
}


function getDraftHighlights(
  pool: SimulatedPool,
  deck: BuiltDeck | null,
  cardMeta: Record<string, CardMeta>,
): SimulatedPickCard[] {
  const picksByOracle = new Map(pool.picks.map((pick) => [pick.oracle_id, pick]));
  const seen = new Set<string>();
  const cards = getPoolMainCards(pool, deck, cardMeta)
    .filter((oracleId) => {
      if (seen.has(oracleId)) return false;
      seen.add(oracleId);
      const typeLower = (cardMeta[oracleId]?.type ?? '').toLowerCase();
      return !typeLower.includes('basic land');
    })
    .sort((a, b) => (cardMeta[b]?.elo ?? 0) - (cardMeta[a]?.elo ?? 0))
    .slice(0, 8);

  return cards.map((oracleId) => {
    const meta = cardMeta[oracleId];
    return (
      picksByOracle.get(oracleId) ?? {
        oracle_id: oracleId,
        name: meta?.name ?? oracleId,
        imageUrl: meta?.imageUrl ?? '',
        packNumber: 0,
        pickNumber: 0,
      }
    );
  });
}

function buildDraftBreakdownRowSummary(
  pool: SimulatedPool,
  deck: BuiltDeck | null,
  cardMeta: Record<string, CardMeta>,
  clusterThemes?: Map<number, { tag: string; lift: number }[]>,
  tagAllowlist?: Set<string>,
): DraftBreakdownRowSummary {
  const composition = getDraftComposition(pool, deck, cardMeta);
  return {
    pool,
    deck,
    colors: pool.archetype,
    themes: inferDraftThemes(pool, deck, cardMeta, clusterThemes, tagAllowlist),
    highlights: getDraftHighlights(pool, deck, cardMeta),
    ...composition,
  };
}

const ColorPips: React.FC<{ colors: string }> = React.memo(({ colors }) => (
  <span className="inline-flex items-center" style={{ gap: 3 }} title={archetypeFullName(colors)}>
    {getColorProfileCodes(colors).map((color) => (
      <span
        key={color}
        className="inline-flex items-center justify-center text-[10px] font-extrabold"
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          background: MTG_COLORS[color]?.bg ?? MTG_COLORS.C!.bg,
          color: 'rgba(17,24,39,0.85)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22), 0 1px 2px rgba(0,0,0,0.12)',
          flexShrink: 0,
        }}
      >
        {color}
      </span>
    ))}
  </span>
));

const TinyCurve: React.FC<{ creatureCounts: number[]; nonCreatureCounts: number[] }> = ({
  creatureCounts,
  nonCreatureCounts,
}) => {
  const max = Math.max(...creatureCounts, ...nonCreatureCounts, 1);
  const title = MANA_CURVE_BUCKETS.map(
    (bucket, index) =>
      `${bucket.label}: ${creatureCounts[index] ?? 0} creatures, ${nonCreatureCounts[index] ?? 0} noncreatures`,
  ).join(' · ');
  return (
    <div className="flex w-fit flex-col gap-px" title={title}>
      <div className="flex h-5 items-end gap-0.5">
        {MANA_CURVE_BUCKETS.map((bucket, index) => {
          const count = creatureCounts[index] ?? 0;
          return (
            <span
              key={bucket.key}
              className="w-2 rounded-sm bg-green-500/80"
              style={{
                height: `${Math.max(2, (count / max) * 18)}px`,
                opacity: count > 0 ? 1 : 0.2,
              }}
            />
          );
        })}
      </div>
      <div className="h-px bg-border" />
      <div className="flex h-5 items-start gap-0.5">
        {MANA_CURVE_BUCKETS.map((bucket, index) => {
          const count = nonCreatureCounts[index] ?? 0;
          return (
            <span
              key={bucket.key}
              className="w-2 rounded-sm bg-link/70"
              style={{
                height: `${Math.max(2, (count / max) * 18)}px`,
                opacity: count > 0 ? 1 : 0.2,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};



// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DraftBreakdownTable: React.FC<{
  pools: SimulatedPool[];
  deckBuilds: BuiltDeck[] | null;
  deckLoading: boolean;
  cardMeta: Record<string, CardMeta>;
  runData: SimulationRunData;
  skeletons?: ArchetypeSkeleton[];
  viewMode: PoolViewMode;
  setViewMode: (mode: PoolViewMode) => void;
  highlightOracle?: string;
  showLocationFilter?: boolean;
  selectedCardName?: string;
  focusedPoolIndex?: number | null;
  onSelectPool?: (poolIndex: number | null) => void;
  poolArchetypeLabels?: Map<number, string> | null;
  poolArchetypeLabelsLoading?: boolean;
  clusterThemes?: Map<number, { tag: string; lift: number }[]>;
  clusterTagAllowlist?: Set<string>;
}> = ({
  pools,
  deckBuilds,
  deckLoading,
  cardMeta,
  runData,
  skeletons,
  viewMode,
  setViewMode,
  highlightOracle,
  showLocationFilter = false,
  selectedCardName,
  focusedPoolIndex = null,
  onSelectPool,
  poolArchetypeLabels,
  poolArchetypeLabelsLoading = false,
  clusterThemes: clusterThemesProp,
  clusterTagAllowlist: clusterTagAllowlistProp,
}) => {
  const hasDeck = !!deckBuilds && deckBuilds.length > 0;
  const hasFullPickOrder = !!runData.setupData;
  const [selectedPool, setSelectedPool] = useState<number | null>(pools[0]?.poolIndex ?? null);
  const [sortKey, setSortKey] = useState<DraftBreakdownSortKey>('draft');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [colorFilter, setColorFilter] = useState('all');
  const [archetypeFilter, setArchetypeFilter] = useState('');
  const [seatFilter, setSeatFilter] = useState('');
  const [draftFilter, setDraftFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState<DeckLocationFilter>('all');
  const [poolPage, setPoolPage] = useState(1);
  const [themeBreakdownOpen, setThemeBreakdownOpen] = useState(false);

  // Use parent-provided themes (computed over all pools) when available; avoids filtered-view degradation.
  const clusterThemes = clusterThemesProp;
  const clusterTagAllowlist = clusterTagAllowlistProp;

  const summaries = useMemo(
    () =>
      pools.map((pool) =>
        buildDraftBreakdownRowSummary(pool, deckBuilds?.[pool.poolIndex] ?? null, cardMeta, clusterThemes, clusterTagAllowlist),
      ),
    [pools, deckBuilds, cardMeta, clusterThemes, clusterTagAllowlist],
  );

  const filtered = summaries.filter((summary) => {
    const pool = summary.pool;
    if (showLocationFilter && highlightOracle && deckBuilds && locationFilter !== 'all') {
      const deck = deckBuilds[pool.poolIndex];
      if (!deck) return true;
      if (locationFilter === 'deck' && !deck.mainboard.includes(highlightOracle)) return false;
      if (locationFilter === 'sideboard' && !deck.sideboard.includes(highlightOracle)) return false;
    }
    if (colorFilter !== 'all' && !getColorProfileCodes(pool.archetype).includes(colorFilter)) return false;
    if (archetypeFilter) {
      const q = archetypeFilter.toLowerCase();
      const themes = summary.themes.map((t) => t.toLowerCase());
      if (!themes.some((t) => t.split(/[\s-]+/).some((word) => word.startsWith(q)))) return false;
    }
    if (seatFilter && pool.seatIndex + 1 !== Number(seatFilter)) return false;
    if (draftFilter && pool.draftIndex + 1 !== Number(draftFilter)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let av: number | string;
    let bv: number | string;
    if (sortKey === 'draft') {
      av = a.pool.draftIndex;
      bv = b.pool.draftIndex;
    } else if (sortKey === 'seat') {
      av = a.pool.seatIndex;
      bv = b.pool.seatIndex;
    } else if (sortKey === 'color') {
      av = a.colors;
      bv = b.colors;
    } else if (sortKey === 'creatures') {
      av = a.creatureCount;
      bv = b.creatureCount;
    } else {
      av = a.avgMv;
      bv = b.avgMv;
    }
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPoolPages = Math.max(1, Math.ceil(sorted.length / POOL_PAGE_SIZE));
  const currentPage = Math.min(poolPage, totalPoolPages);
  const pagedPools = sorted.slice((currentPage - 1) * POOL_PAGE_SIZE, currentPage * POOL_PAGE_SIZE);
  const selectedSummary = sorted.find((summary) => summary.pool.poolIndex === selectedPool) ?? pagedPools[0] ?? null;

  useEffect(() => {
    setSelectedPool(pools[0]?.poolIndex ?? null);
    setPoolPage(1);
  }, [pools]);
  useEffect(() => {
    if (focusedPoolIndex === null) return;
    if (pools.some((pool) => pool.poolIndex === focusedPoolIndex)) setSelectedPool(focusedPoolIndex);
  }, [focusedPoolIndex, pools]);
  useEffect(() => {
    setPoolPage(1);
  }, [colorFilter, archetypeFilter, seatFilter, draftFilter, locationFilter, sortKey, sortDir]);
  useEffect(() => {
    if (poolPage > totalPoolPages) setPoolPage(totalPoolPages);
  }, [poolPage, totalPoolPages]);

  const handleSort = (key: DraftBreakdownSortKey) => {
    if (sortKey === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'color' ? 'asc' : 'desc');
    }
  };
  const renderSortHeader = (label: string, key: DraftBreakdownSortKey, className = 'text-left') => (
    <th scope="col" className={`px-3 py-2 text-xs font-semibold text-text-secondary ${className}`}>
      <button
        type="button"
        className="w-full rounded px-1 py-0.5 text-inherit hover:bg-bg-active"
        onClick={() => handleSort(key)}
      >
        {label}
        {sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );

  return (
    <Flexbox direction="col" gap="3">
      <div>
      {/* Toolbar — visually attached to the table */}
      <div className="flex flex-wrap items-center gap-2 rounded-t-lg border border-border bg-bg-accent px-3 py-2">
        {showLocationFilter && hasDeck && (
          <div className="flex items-center gap-1">
            {(['all', 'deck', 'sideboard'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setLocationFilter(v)}
                className={[
                  'px-2 py-1 rounded text-xs font-medium border',
                  locationFilter === v
                    ? 'bg-link text-white border-link'
                    : 'bg-bg text-text-secondary border-border hover:bg-bg-active',
                ].join(' ')}
              >
                {v === 'all' ? 'In pool' : v === 'deck' ? 'In deck' : 'In sideboard'}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1">
          {['all', ...COLOR_KEYS, 'C'].map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setColorFilter(color)}
              className={[
                'h-7 rounded px-2 text-xs font-semibold border',
                colorFilter === color
                  ? 'bg-link text-white border-link'
                  : 'bg-bg text-text-secondary border-border hover:bg-bg-active',
              ].join(' ')}
            >
              {color === 'all' ? 'All' : color}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Input
            type="text"
            placeholder="Theme"
            value={archetypeFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setArchetypeFilter(e.target.value)}
            className="w-32"
          />
          <Input
            type="number"
            placeholder="Seat"
            value={seatFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSeatFilter(e.target.value)}
            className="w-20"
          />
          <Input
            type="number"
            placeholder="Draft"
            value={draftFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraftFilter(e.target.value)}
            className="w-20"
          />
        </div>
      </div>

      {/* Mobile list */}
      <div className="divide-y divide-border rounded-b border border-t-0 border-border bg-bg md:hidden">
        {pagedPools.map((summary) => {
          const isSelected = selectedPool === summary.pool.poolIndex;
          const artImages = summary.highlights
            .slice(0, 5)
            .filter((c) => c.imageUrl)
            .map((c) => ({ ...c, imageUrl: c.imageUrl.replace('/normal/', '/art_crop/') }));
          return (
            <button
              key={summary.pool.poolIndex}
              type="button"
              className={[
                'block w-full px-3 py-3 text-left hover:bg-bg-active border-l-2',
                isSelected ? 'bg-link/5 border-link' : 'border-transparent',
              ].join(' ')}
              onClick={() => { setSelectedPool(summary.pool.poolIndex); onSelectPool?.(summary.pool.poolIndex); }}
            >
              <Flexbox direction="row" justify="between" alignItems="start" className="gap-2">
                <div className="min-w-0 flex-1">
                  <Text sm semibold className="block">
                    Draft {summary.pool.draftIndex + 1} · Seat {summary.pool.seatIndex + 1}
                  </Text>
                  <div className="mt-0.5">
                    {poolArchetypeLabels ? (
                      <span className="text-[11px] font-medium">
                        {summary.colors && summary.colors !== 'C' && (
                          <span className="text-text-secondary mr-1">{summary.colors}</span>
                        )}
                        <span className="text-link">{poolArchetypeLabels.get(summary.pool.poolIndex) ?? '—'}</span>
                      </span>
                    ) : poolArchetypeLabelsLoading ? (
                      <span className="inline-block h-3 w-24 animate-pulse rounded bg-bg-accent" />
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {summary.themes.map((theme) => (
                      <span key={theme} className="rounded bg-bg-accent px-1.5 py-0.5 text-[11px] text-text-secondary">
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {poolArchetypeLabelsLoading && <span className="inline-block h-3 w-16 animate-pulse rounded bg-bg-accent" />}
                  {artImages.length > 0 && (
                    <div className="flex gap-0.5 ml-1">
                      {artImages.map((c) => (
                        <div key={c.oracle_id} className="flex-shrink-0 overflow-hidden rounded" style={{ width: 48, height: 48 }} title={c.name}>
                          <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover object-center" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Flexbox>
            </button>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-b border border-t-0 border-border bg-bg md:block">
        <table className="min-w-full text-base" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 150 }} />
            <col style={{ width: 200 }} />
            <col style={{ width: 180 }} />
            <col style={{ width: 340 }} />

            <col style={{ width: 200 }} />
            <col style={{ width: 160 }} />
            <col />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="border-b-2 border-border bg-bg-accent">
              {renderSortHeader('Draft · Seat', 'draft')}
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">
                Archetype
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">
                Color share
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">
                Theme
              </th>
              {renderSortHeader('Composition', 'creatures')}
              {renderSortHeader('Curve', 'avgMv')}
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">
                Key cards
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {pagedPools.map((summary) => {
              const isSelected = selectedPool === summary.pool.poolIndex;
              const artImages = summary.highlights
                .slice(0, 8)
                .filter((c) => c.imageUrl)
                .map((c) => ({ ...c, imageUrl: c.imageUrl.replace('/normal/', '/art_crop/') }));
              return (
                <tr
                  key={summary.pool.poolIndex}
                  className={[
                    'cursor-pointer transition-colors duration-100',
                    isSelected
                      ? 'border-l-[3px] border-l-link'
                      : 'border-l-[3px] border-l-transparent hover:bg-bg-active',
                  ].join(' ')}
                  style={isSelected ? { background: 'rgb(var(--link) / 0.07)', boxShadow: 'inset 3px 0 0 rgb(var(--link))' } : undefined}
                  onClick={() => { setSelectedPool(summary.pool.poolIndex); onSelectPool?.(summary.pool.poolIndex); }}
                >
                  <td className="px-3 py-4 tabular-nums">
                    <span className={isSelected ? 'font-bold text-text' : 'font-semibold text-text'}>
                      D{summary.pool.draftIndex + 1}
                    </span>
                    <span className="text-text-secondary"> · S{summary.pool.seatIndex + 1}</span>
                  </td>
                  <td className="px-3 py-4">
                    {poolArchetypeLabels ? (
                      <span className="text-xs font-medium text-link">
                        {summary.colors && summary.colors !== 'C' && `${summary.colors} `}
                        {poolArchetypeLabels.get(summary.pool.poolIndex) ?? '—'}
                      </span>
                    ) : poolArchetypeLabelsLoading ? (
                      <span className="inline-block h-3 w-28 animate-pulse rounded bg-bg-accent" />
                    ) : null}
                  </td>
                  <td className="px-3 py-4">
                    <RowColorShare deck={summary.deck} cardMeta={cardMeta} />
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex flex-wrap gap-1">
                      {summary.themes.map((theme) => (
                        <span
                          key={theme}
                          className="inline-flex items-center rounded bg-bg-accent px-2 text-xs font-semibold text-text-secondary"
                          style={{ height: 22 }}
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 tabular-nums" style={{ height: 22, fontSize: 12, background: '#dbeafe', color: '#3b82f6' }}>
                        <span className="font-bold" style={{ color: '#1d4ed8' }}>{summary.creatureCount}</span>
                        <span style={{ opacity: 0.75 }}>C</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full px-2 tabular-nums" style={{ height: 22, fontSize: 12, background: '#f1f5f9', color: '#64748b' }}>
                        <span className="font-bold" style={{ color: '#334155' }}>{summary.nonCreatureCount}</span>
                        <span style={{ opacity: 0.75 }}>NC</span>
                      </span>
                      {summary.landCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 tabular-nums" style={{ height: 22, fontSize: 12, background: '#fef3c7', color: '#92400e' }}>
                          <span className="font-bold" style={{ color: '#78350f' }}>{summary.landCount}</span>
                          <span style={{ opacity: 0.75 }}>L</span>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <TinyCurve
                      creatureCounts={summary.creatureCurveCounts}
                      nonCreatureCounts={summary.nonCreatureCurveCounts}
                    />
                  </td>
                  <td className="py-1.5 pr-2 pl-6">
                    <div className="flex gap-0.5">
                      {artImages.slice(0, 6).map((c) => (
                        <div
                          key={c.oracle_id}
                          className="flex-shrink-0 overflow-hidden transition-transform duration-100 hover:-translate-y-0.5"
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 7,
                            border: '1px solid rgba(17,24,39,0.08)',
                          }}
                          title={c.name}
                        >
                          <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover object-center" />
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>{/* end toolbar+table wrapper */}

      {sorted.length === 0 && (
        <Text sm className="text-text-secondary">
          No pools match the current filters.
        </Text>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <Text xs className="text-text-secondary">
          {sorted.length} seats · page {currentPage} of {totalPoolPages}
        </Text>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPoolPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded-md text-xs font-semibold border bg-bg text-text-secondary border-border hover:bg-bg-active disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={() => setPoolPage((p) => Math.min(totalPoolPages, p + 1))}
            disabled={currentPage === totalPoolPages}
            className="px-3 py-1 rounded-md text-xs font-semibold border bg-bg text-text-secondary border-border hover:bg-bg-active disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      </div>

      {selectedSummary && (
        <div className="rounded-lg border border-link/30 bg-link/5 overflow-hidden">
          <Flexbox
            direction="row"
            justify="between"
            alignItems="center"
            className="flex-wrap gap-2 border-b border-link/20 bg-link/10 px-3 py-2"
          >
            <div>
              <Text sm semibold className="block">
                Draft {selectedSummary.pool.draftIndex + 1} · Seat {selectedSummary.pool.seatIndex + 1}
              </Text>
              {poolArchetypeLabels && (
                <span className="block text-xs font-medium">
                  {selectedSummary.colors && selectedSummary.colors !== 'C' && (
                    <span className="text-text-secondary mr-1">{selectedSummary.colors}</span>
                  )}
                  <span className="text-link">{poolArchetypeLabels.get(selectedSummary.pool.poolIndex) ?? '—'}</span>
                </span>
              )}
              <Text xs className="block text-text-secondary">
                {selectedSummary.themes.join(', ')}
                {selectedCardName ? ` · ${selectedCardName}` : ''}
              </Text>
              {/* OTAG bucket → cards breakdown (collapsed by default) */}
              {themeBreakdownOpen && (() => {
                const deck = deckBuilds?.[selectedSummary.pool.poolIndex] ?? null;
                const mainCards = getPoolMainCards(selectedSummary.pool, deck, cardMeta);
                const bucketMap = new Map<string, { name: string; rawTags: string[] }[]>();
                for (const oracleId of mainCards) {
                  const meta = cardMeta[oracleId];
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
                const buckets = [...bucketMap.entries()]
                  .filter(([, cards]) => cards.length > 1)
                  .sort((a, b) => b[1].length - a[1].length);
                if (buckets.length === 0) return null;
                return (
                  <div className="mt-1.5 text-[10px] font-mono leading-tight">
                    {buckets.map(([bucket, cards]) => (
                      <div key={bucket} className="mb-1.5">
                        <span className="font-bold text-link">{bucket} ({cards.length})</span>
                        <div className="ml-2">
                          {cards.map(({ name, rawTags }) => (
                            <div key={name} className="text-text-secondary">
                              {name}{' '}
                              <span className="opacity-50">[{rawTags.join(', ')}]</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setThemeBreakdownOpen((o) => !o)}
                className="text-[11px] text-text-secondary hover:text-text transition-colors whitespace-nowrap"
              >
                {themeBreakdownOpen ? '▾ Hide' : '▸ Show'} breakdown
              </button>
              <ViewToggle
                mode={viewMode}
                onChange={setViewMode}
                hasDeck={hasDeck}
                hasFullPickOrder={hasFullPickOrder}
                deckLoading={deckLoading}
              />
            </div>
          </Flexbox>
          <PoolExpansionContent
            pool={selectedSummary.pool}
            mode={viewMode}
            deck={deckBuilds?.[selectedSummary.pool.poolIndex] ?? null}
            cardMeta={cardMeta}
            runData={runData}
            highlightOracle={highlightOracle}
          />
        </div>
      )}
    </Flexbox>
  );
};

const POOL_PAGE_SIZE = 10;

const SkeletonCardImage: React.FC<{ card: SkeletonCard; size?: number }> = React.memo(({ card, size }) => (
  <AutocardLink
    href={`/tool/card/${encodeURIComponent(card.oracle_id)}`}
    className="relative block hover:opacity-95"
    style={size ? { width: size } : undefined}
    title={`${card.name} — ${(card.fraction * 100).toFixed(0)}% of pools`}
    card={{ details: autocardDetails(card.oracle_id, card.name, card.imageUrl) } as any}
  >
    {card.imageUrl ? (
      <img
        src={card.imageUrl}
        alt={card.name}
        className="w-full rounded border border-border shadow-sm"
        style={{ imageRendering: 'auto' }}
      />
    ) : (
      <div
        className="w-full flex items-center justify-center text-xs text-text-secondary bg-bg-accent rounded border border-border p-1 text-center shadow-sm"
        style={{ aspectRatio: '488 / 680' }}
      >
        {card.name}
      </div>
    )}
    <div
      className="absolute bottom-1 right-1 bg-black/70 text-white font-bold rounded px-1 py-0.5 leading-tight shadow-sm"
      style={{ fontSize: 9 }}
    >
      {(card.fraction * 100).toFixed(0)}%
    </div>
  </AutocardLink>
));

const LinkedCardImage: React.FC<{ oracleId: string; name: string; imageUrl: string; size: number }> = ({
  oracleId,
  name,
  imageUrl,
  size,
}) => (
  <AutocardLink
    href={`/tool/card/${encodeURIComponent(oracleId)}`}
    className="relative flex-shrink-0 block hover:opacity-95"
    style={{ width: size }}
    card={{ details: autocardDetails(oracleId, name, imageUrl) } as any}
  >
    <img src={imageUrl} alt={name} className="w-full rounded border border-border shadow-sm" />
  </AutocardLink>
);

interface MapSelectedCardInfo {
  cardImages: { oracleId: string; name: string; imageUrl: string }[];
  name: string; // joined display name
  pickRate?: number; // only set for single-card selection
  avgPickPosition?: number;
  onClear: () => void;
}

/** Panel shown to the right of the Draft Map when a cluster is selected. */
const ClusterDetailPanel: React.FC<{
  skeleton: ArchetypeSkeleton;
  clusterIndex: number;
  totalPools: number;
  clusterDeckBuilds: BuiltDeck[] | null;
  cubeOracleSet: Set<string>;
  cardMeta: Record<string, CardMeta>;
  commonCards?: SkeletonCard[];
  slimPools: SlimPool[];
  deckBuilds?: BuiltDeck[] | null;
  themes?: string[];
  poolArchetypeLabels?: Map<number, string> | null;
  onOpenPool: (poolIndex: number) => void;
  onClose: () => void;
}> = ({ skeleton, clusterIndex, totalPools, clusterDeckBuilds, cubeOracleSet, cardMeta, commonCards = [], slimPools, deckBuilds, themes, poolArchetypeLabels, onOpenPool, onClose }) => {
  const { csrfFetch } = useContext(CSRFContext);

  // Compute actual color profile from deck color shares (≥10% threshold)
  const colorProfile = useMemo(() => {
    if (!clusterDeckBuilds || clusterDeckBuilds.length === 0) return normalizeColorOrder(skeleton.colorProfile);
    const shares: Record<string, number> = Object.fromEntries(COLOR_KEYS.map((k) => [k, 0]));
    for (const deck of clusterDeckBuilds) {
      for (const oracle of deck.mainboard) {
        const colors = getDeckShareColors(oracle, cardMeta).filter((c) => c !== 'C');
        if (colors.length === 0) continue;
        const share = 1 / colors.length;
        for (const c of colors) shares[c] = (shares[c] ?? 0) + share;
      }
    }
    const total = COLOR_KEYS.reduce((s, k) => s + (shares[k] ?? 0), 0);
    if (total === 0) return 'C';
    const significant = COLOR_KEYS.filter((k) => (shares[k] ?? 0) / total >= 0.1);
    return significant.length > 0 ? significant.join('') : 'C';
  }, [clusterDeckBuilds, cardMeta, skeleton.colorProfile]);

  const CARD_TABS = [
    { key: 'common', label: 'Common Cards', title: 'Cards appearing most often across decks in this cluster' },
    { key: 'signature', label: 'Signature Cards', title: 'Cards that appear significantly more in this cluster than in others — contrastive scoring vs. neighboring clusters' },
    { key: 'exemplary', label: 'Exemplary Deck', title: 'A real deck from this cluster chosen to best match the cluster’s representative high-priority card bucket' },
    { key: 'recommendations', label: 'Recommendations', title: 'Use the cluster as a local recommender seed and suggest cards that would strengthen it' },
  ] as const;
  type CardTab = typeof CARD_TABS[number]['key'];
  const [cardTab, setCardTab] = useState<CardTab>('common');

  // Greedy co-occurrence chain: each card is chosen because it appears alongside
  // ALL previously selected cards as often as possible.
  const hasDecks = deckBuilds && deckBuilds.length === slimPools.length;

  const exemplaryDeck = useMemo(() => {
    if (!hasDecks) return null;

    const representativeWeights = new Map<string, number>();
    const representativeTopN = 12;

    for (const poolIndex of skeleton.poolIndices) {
      const deck = deckBuilds![poolIndex]!;
      const mainboardSet = new Set(deck.mainboard);
      const ranked =
        deck.deckbuildRatings && deck.deckbuildRatings.length > 0
          ? deck.deckbuildRatings.filter((entry) => mainboardSet.has(entry.oracle)).slice(0, representativeTopN)
          : deck.mainboard.slice(0, representativeTopN).map((oracle, index) => ({ oracle, rating: representativeTopN - index }));

      ranked.forEach((entry, index) => {
        const rankWeight = (representativeTopN - index) / representativeTopN;
        representativeWeights.set(entry.oracle, (representativeWeights.get(entry.oracle) ?? 0) + rankWeight);
      });
    }

    let best:
      | {
          poolIndex: number;
          deck: BuiltDeck;
          score: number;
          overlap: number;
          topCards: string[];
        }
      | null = null;

    for (const poolIndex of skeleton.poolIndices) {
      const deck = deckBuilds![poolIndex]!;
      const mainboardSet = new Set(deck.mainboard);
      let score = 0;
      let overlap = 0;
      for (const [oracle, weight] of representativeWeights) {
        if (!mainboardSet.has(oracle)) continue;
        score += weight;
        overlap += 1;
      }

      const topCards =
        deck.deckbuildRatings && deck.deckbuildRatings.length > 0
          ? deck.deckbuildRatings.filter((entry) => mainboardSet.has(entry.oracle)).slice(0, 8).map((entry) => entry.oracle)
          : deck.mainboard.slice(0, 8);

      if (!best || score > best.score || (score === best.score && overlap > best.overlap)) {
        best = { poolIndex, deck, score, overlap, topCards };
      }
    }

    return best;
  }, [cardMeta, deckBuilds, hasDecks, skeleton.poolIndices]);

  const recommendationSeedCards = useMemo(() => {
    const totalClusterPools = skeleton.poolIndices.length;
    if (totalClusterPools === 0) return [] as Array<SkeletonCard & { count: number }>;

    const counts = new Map<string, number>();
    for (const poolIndex of skeleton.poolIndices) {
      const cards = hasDecks
        ? deckBuilds![poolIndex]!.mainboard
        : slimPools[poolIndex]!.picks.map((pick) => pick.oracle_id);
      for (const oracle of new Set(cards)) {
        counts.set(oracle, (counts.get(oracle) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .filter(([oracle]) => !(cardMeta[oracle]?.type?.includes('Basic') && cardMeta[oracle]?.type?.includes('Land')))
      .map(([oracle, count]) => ({
        oracle_id: oracle,
        name: cardMeta[oracle]?.name ?? oracle,
        imageUrl: cardMeta[oracle]?.imageUrl ?? '',
        fraction: count / totalClusterPools,
        count,
      }))
      .sort((a, b) => b.fraction - a.fraction || a.name.localeCompare(b.name));
  }, [cardMeta, deckBuilds, hasDecks, skeleton.poolIndices, slimPools]);

  const recommendationInputCards = useMemo(() => {
    const minSeedCount = Math.max(2, Math.ceil(skeleton.poolCount * 0.1));
    const frequentCards = recommendationSeedCards.filter((card) => card.count >= minSeedCount);
    const seedCards = frequentCards.length >= 20 ? frequentCards : recommendationSeedCards.slice(0, 40);
    return seedCards.slice(0, 120);
  }, [recommendationSeedCards, skeleton.poolCount]);

  const recommendationInputOracles = useMemo(
    () => recommendationInputCards.map((card) => card.oracle_id),
    [recommendationInputCards],
  );
  const recommendationInputThreshold = useMemo(
    () => (skeleton.poolCount > 0 ? Math.max(2, Math.ceil(skeleton.poolCount * 0.1)) : 0),
    [skeleton.poolCount],
  );

  type ClusterRecommendation = { oracle: string; rating: number; details: CardDetails };
  const [clusterRecommendations, setClusterRecommendations] = useState<ClusterRecommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [excludeClusterLands, setExcludeClusterLands] = useState(true);
  const [excludeRecommendationLands, setExcludeRecommendationLands] = useState(true);

  const visibleCommonCards = useMemo(
    () =>
      (commonCards.length > 0 ? commonCards : skeleton.coreCards).filter(
        (card) => !excludeClusterLands || !cardMeta[card.oracle_id]?.type?.includes('Land'),
      ),
    [cardMeta, commonCards, excludeClusterLands, skeleton.coreCards],
  );
  const visibleSignatureCards = useMemo(
    () =>
      (skeleton.signatureCards ?? []).filter(
        (card) => !excludeClusterLands || !cardMeta[card.oracle_id]?.type?.includes('Land'),
      ),
    [cardMeta, excludeClusterLands, skeleton.signatureCards],
  );

  const visibleClusterRecommendations = useMemo(
    () =>
      excludeRecommendationLands
        ? clusterRecommendations.filter((item) => !item.details.type?.includes('Land'))
        : clusterRecommendations,
    [clusterRecommendations, excludeRecommendationLands],
  );

  useEffect(() => {
    let cancelled = false;

    if (cardTab !== 'recommendations') {
      return () => {
        cancelled = true;
      };
    }
    if (recommendationInputOracles.length === 0) {
      setClusterRecommendations([]);
      setRecommendationsError(null);
      setRecommendationsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      setRecommendationsLoading(true);
      setRecommendationsError(null);
      try {
        await loadDraftRecommender();
        const remapping = buildOracleRemapping(cardMeta);
        const { adds } = await localRecommend(recommendationInputOracles, remapping);
        if (cancelled) return;

        const candidateOracles = adds.slice(0, 80).map((item) => item.oracle);
        const response = await csrfFetch('/cube/api/getdetailsforcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: candidateOracles }),
        });
        if (!response.ok) throw new Error(`Failed to load recommendation details: ${response.status}`);
        const data = await response.json();
        if (cancelled) return;

        const detailsByOracle = new Map<string, CardDetails>();
        const detailsList: CardDetails[] = Array.isArray(data?.details) ? data.details : [];
        for (const details of detailsList) {
          if (details?.oracle_id) detailsByOracle.set(details.oracle_id, details);
        }

        const filtered = adds
          .filter((item) => !cubeOracleSet.has(item.oracle))
          .map((item) => ({ ...item, details: detailsByOracle.get(item.oracle) }))
          .filter(
            (item): item is ClusterRecommendation =>
              !!item.details &&
              !item.details.isToken &&
              !(item.details.type?.includes('Basic') && item.details.type?.includes('Land')),
          )
          .slice(0, 24);

        setClusterRecommendations(filtered);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load cluster recommendations:', err);
        setClusterRecommendations([]);
        setRecommendationsError('Unable to generate recommendations for this cluster.');
      } finally {
        if (!cancelled) setRecommendationsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cardMeta, cardTab, csrfFetch, cubeOracleSet, recommendationInputOracles]);

  const colorCodes = getColorProfileCodes(colorProfile);
  const pct = totalPools > 0 ? ((skeleton.poolCount / totalPools) * 100).toFixed(1) : '0';

  // Top Gwen archetype labels within this cluster
  const clusterArchetypes = useMemo(() => {
    if (!poolArchetypeLabels) return [];
    const counts = new Map<string, number>();
    for (const pi of skeleton.poolIndices) {
      const label = poolArchetypeLabels.get(pi);
      if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [poolArchetypeLabels, skeleton.poolIndices]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 pt-2">
          <div>
            <div><Text semibold className="text-lg leading-snug">
              {clusterArchetypes.length > 0
                ? `${colorProfile && colorProfile !== 'C' ? `${colorProfile} ` : ''}${clusterArchetypes[0]![0]}`
                : archetypeFullName(colorProfile)}
            </Text></div>
            <div><Text xs className="text-text-secondary">
              Cluster {clusterIndex + 1} · {skeleton.poolCount} seats · {pct}%
            </Text></div>
          </div>
          {themes && themes.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {themes.map((theme) => (
                <span
                  key={theme}
                  className="inline-flex text-[10px] bg-bg-accent border border-border/60 rounded px-1.5 py-0.5 text-text-secondary"
                >
                  {theme}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active flex-shrink-0"
        >
          ✕
        </button>
      </div>
      <div>
        <div className="flex flex-row border-b border-border mb-3">
          {CARD_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setCardTab(tab.key)}
              title={tab.title}
              className={[
                'px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors',
                cardTab === tab.key
                  ? 'border-link text-link'
                  : 'border-transparent text-text-secondary hover:text-text hover:border-border',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {cardTab === 'common' && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={excludeClusterLands}
                  onChange={(event) => setExcludeClusterLands(event.target.checked)}
                />
                Exclude lands
              </label>
            </div>
            {visibleCommonCards.length > 0 ? (
              <div className="grid grid-cols-6 gap-1.5">
                {visibleCommonCards.slice(0, 12).map((card) => (
                  <SkeletonCardImage key={card.oracle_id} card={card} />
                ))}
              </div>
            ) : (
              <Text sm className="text-text-secondary">No common cards remain after filtering.</Text>
            )}
          </div>
        )}
        {cardTab === 'signature' && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={excludeClusterLands}
                  onChange={(event) => setExcludeClusterLands(event.target.checked)}
                />
                Exclude lands
              </label>
            </div>
            {visibleSignatureCards.length > 0 ? (
              <div className="grid grid-cols-6 gap-1.5">
                {visibleSignatureCards.slice(0, 12).map((card) => (
                  <SkeletonCardImage key={card.oracle_id} card={card} />
                ))}
              </div>
            ) : (
              <Text sm className="text-text-secondary">
                {(skeleton.signatureCards ?? []).length === 0
                  ? 'No signature cards found for this cluster.'
                  : 'No signature cards remain after filtering.'}
              </Text>
            )}
          </div>
        )}
        {cardTab === 'exemplary' && (
          <div className="flex flex-col gap-3">
            {exemplaryDeck ? (
              <>
                <div className="flex items-center justify-between gap-3 flex-wrap rounded border border-border/60 bg-bg-accent/30 px-3 py-2">
                  <div>
                    <Text sm semibold>
                      Draft {slimPools[exemplaryDeck.poolIndex]!.draftIndex + 1} · Seat {slimPools[exemplaryDeck.poolIndex]!.seatIndex + 1}
                    </Text>
                    <Text xs className="text-text-secondary">
                      Matches {exemplaryDeck.overlap} representative cards from the cluster bucket.
                    </Text>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenPool(exemplaryDeck.poolIndex)}
                    className="px-3 py-1.5 rounded text-xs font-semibold border bg-bg text-text-secondary border-border hover:bg-bg-active"
                  >
                    Open in detailed view
                  </button>
                </div>
                <SimDeckView deck={exemplaryDeck.deck} cardMeta={cardMeta} />
              </>
            ) : (
              <Text sm className="text-text-secondary">Deck builds are required to show an exemplary deck.</Text>
            )}
          </div>
        )}
        {cardTab === 'recommendations' && (
          <div className="flex flex-col gap-4">
            <div className="rounded border border-border/60 bg-bg-accent/30 p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <Text xs className="text-text-secondary">
                  Using {recommendationInputCards.length} cluster cards as the seed set.
                  {recommendationInputThreshold > 0
                    ? ` Seed cards appear in at least ${recommendationInputThreshold} decks when possible.`
                    : ''}
                </Text>
                <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={excludeRecommendationLands}
                    onChange={(event) => setExcludeRecommendationLands(event.target.checked)}
                  />
                  Exclude lands
                </label>
              </div>
            </div>
            <div>
              <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">
                Recommended Additions
              </Text>
              {recommendationsLoading ? (
                <Text sm className="text-text-secondary">Generating recommendations…</Text>
              ) : recommendationsError ? (
                <Text sm className="text-text-secondary">{recommendationsError}</Text>
              ) : visibleClusterRecommendations.length > 0 ? (
                <div className="grid grid-cols-6 gap-1.5">
                  {visibleClusterRecommendations.map((item) => (
                    <AutocardLink
                      key={item.oracle}
                      href={`/tool/card/${encodeURIComponent(item.oracle)}`}
                      className="relative block hover:opacity-95"
                      title={item.details.name}
                      card={{ cardID: item.oracle, details: item.details } as CardType}
                    >
                      <img
                        src={item.details.image_normal || `/tool/cardimage/${encodeURIComponent(item.oracle)}`}
                        alt={item.details.name}
                        className="w-full rounded border border-border shadow-sm"
                        style={{ imageRendering: 'auto' }}
                      />
                    </AutocardLink>
                  ))}
                </div>
              ) : (
                <Text sm className="text-text-secondary">
                  {clusterRecommendations.length > 0
                    ? 'No recommendations remain after filtering.'
                    : 'No recommendations returned for this cluster.'}
                </Text>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-row gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Deck Color Share</Text>
          <DeckColorShareChart deckBuilds={clusterDeckBuilds} cardMeta={cardMeta} />
        </div>
        <div className="flex-1 min-w-0">
          <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Card Types</Text>
          <CardTypeShareChart deckBuilds={clusterDeckBuilds} cardMeta={cardMeta} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div>
            <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Mana Curve Share</Text>
            <ManaCurveShareChart deckBuilds={clusterDeckBuilds} cardMeta={cardMeta} />
          </div>
          <div>
            <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Elo Distribution</Text>
            <EloDistributionChart deckBuilds={clusterDeckBuilds} cardMeta={cardMeta} />
          </div>
        </div>
      </div>
    </div>
  );
};

const DraftMapScopePanel: React.FC<{
  title: string;
  subtitle: string;
  commonCards: SkeletonCard[];
  deckBuilds: BuiltDeck[] | null;
  cardMeta: Record<string, CardMeta>;
  selectedCardInfo?: MapSelectedCardInfo;
  matchingCount: number;
}> = ({ title, subtitle, commonCards, deckBuilds, cardMeta, selectedCardInfo, matchingCount }) => {
  return (
  <div className="flex flex-col gap-5">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 pt-2">
        <div><Text semibold className="text-lg leading-snug">
          {selectedCardInfo
            ? (title ? `${selectedCardInfo.name} in ${title}` : selectedCardInfo.name)
            : title}
        </Text></div>
        <div className="mt-1"><Text xs className="text-text-secondary">{subtitle}</Text></div>
        {selectedCardInfo && (selectedCardInfo.pickRate !== undefined || (selectedCardInfo.avgPickPosition ?? 0) > 0) && (
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {selectedCardInfo.pickRate !== undefined && (
              <span className="text-sm text-text-secondary/50">Pick rate <span className="text-text-secondary/80">{(selectedCardInfo.pickRate * 100).toFixed(1)}%</span></span>
            )}
            {(selectedCardInfo.avgPickPosition ?? 0) > 0 && (
              <span className="text-sm text-text-secondary/50">Avg pos <span className="text-text-secondary/80">{selectedCardInfo.avgPickPosition!.toFixed(1)}</span></span>
            )}
          </div>
        )}
      </div>
      {selectedCardInfo && (
        <button
          type="button"
          onClick={selectedCardInfo.onClear}
          className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active flex-shrink-0"
        >
          ✕
        </button>
      )}
    </div>
    {matchingCount === 0 ? (
      <Text sm className="text-text-secondary">No pools match all active filters. Try removing a card or changing the scope.</Text>
    ) : (
      <>
        {(selectedCardInfo?.cardImages.length || commonCards.length > 0) ? (
          <div className="flex flex-col gap-3">
            {selectedCardInfo && selectedCardInfo.cardImages.length > 0 && (
              <div className="grid grid-cols-6 gap-1.5">
                {selectedCardInfo.cardImages.map((img) => (
                  <AutocardLink
                    key={img.oracleId}
                    href={`/tool/card/${encodeURIComponent(img.oracleId)}`}
                    className="block hover:opacity-95"
                    card={{ details: autocardDetails(img.oracleId, img.name, img.imageUrl) } as any}
                  >
                    <img src={img.imageUrl} alt={img.name} className="w-full rounded border-2 border-primary shadow-sm" />
                  </AutocardLink>
                ))}
              </div>
            )}
            {commonCards.length > 0 && (
              <div>
                <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Most common cards in matching pools</Text>
                <div className="grid grid-cols-6 gap-1.5">
                  {commonCards.slice(0, selectedCardInfo ? 6 : 12).map((card) => (
                    <SkeletonCardImage key={card.oracle_id} card={card} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
        <div className="flex flex-row gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Deck Color Share</Text>
            <DeckColorShareChart deckBuilds={deckBuilds} cardMeta={cardMeta} />
          </div>
          <div className="flex-1 min-w-0">
            <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Card Types</Text>
            <CardTypeShareChart deckBuilds={deckBuilds} cardMeta={cardMeta} />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            <div>
              <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Mana Curve Share</Text>
              <ManaCurveShareChart deckBuilds={deckBuilds} cardMeta={cardMeta} />
            </div>
            <div>
              <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Elo Distribution</Text>
              <EloDistributionChart deckBuilds={deckBuilds} cardMeta={cardMeta} />
            </div>
          </div>
        </div>
      </>
    )}
  </div>
  );
};

const DraftMapCard: React.FC<{
  skeletons: ArchetypeSkeleton[];
  showAdvancedClustering: boolean;
  pendingKnnK: number;
  setPendingKnnK: (v: number) => void;
  pendingResolution: number;
  setPendingResolution: (v: number) => void;
  clusteringInProgress: boolean;
  clusteringPhase: string | null;
  applyPendingClusteringSettings: () => void;
  draftMapPoints: DraftMapPoint[];
  showDraftMapScopePanel: boolean;
  activeFilterPoolIndexSet: Set<number> | null;
  draftMapColorMode: DraftMapColorMode;
  setDraftMapColorMode: React.Dispatch<React.SetStateAction<DraftMapColorMode>>;
  focusedPoolIndex: number | null;
  setFocusedPoolIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setSelectedSkeletonId: React.Dispatch<React.SetStateAction<number | null>>;
  selectedSkeletonId: number | null;
  setSelectedArchetype: React.Dispatch<React.SetStateAction<string | null>>;
  setDraftBreakdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mapPanelHasBoth: boolean;
  selectedCards: CardStats[];
  displayRunData: SimulationRunData;
  selectedCard: CardStats | null;
  selectedCardStats: CardStats | null;
  statsForScope: CardStats | null;
  selectedCardScopeLabel: string | null;
  detailedViewTitle: string;
  detailedViewSubtitle: string;
  activeFilterPreview: {
    commonCards: SkeletonCard[];
    supportCards: SkeletonCard[];
    sideboardCards: SkeletonCard[];
    lockPairs: LockPair[];
  } | null;
  activeDecks: BuiltDeck[] | null;
  clusterThemesByClusterId: Map<number, string[]>;
  poolArchetypeLabels: Map<number, string> | null;
  activeFilterSummary: string | null;
  scopeOnlySummary: string | null;
  filteredDecks: BuiltDeck[] | null;
  draftMapScopeSubtitle: string;
  draftMapScopeSeatCount: number;
  onClearSelectedCards: () => void;
  cubeOracleSet: Set<string>;
}> = ({
  skeletons,
  showAdvancedClustering,
  pendingKnnK,
  setPendingKnnK,
  pendingResolution,
  setPendingResolution,
  clusteringInProgress,
  clusteringPhase,
  applyPendingClusteringSettings,
  draftMapPoints,
  showDraftMapScopePanel,
  activeFilterPoolIndexSet,
  draftMapColorMode,
  setDraftMapColorMode,
  focusedPoolIndex,
  setFocusedPoolIndex,
  setSelectedSkeletonId,
  selectedSkeletonId,
  setSelectedArchetype,
  setDraftBreakdownOpen,
  mapPanelHasBoth,
  selectedCards,
  displayRunData,
  selectedCard,
  selectedCardStats,
  statsForScope,
  selectedCardScopeLabel,
  detailedViewTitle,
  detailedViewSubtitle,
  activeFilterPreview,
  activeDecks,
  clusterThemesByClusterId,
  poolArchetypeLabels,
  activeFilterSummary,
  scopeOnlySummary,
  filteredDecks,
  draftMapScopeSubtitle,
  draftMapScopeSeatCount,
  onClearSelectedCards,
  cubeOracleSet,
}) => {
  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <div className="flex flex-row items-baseline gap-3">
              <Text semibold>Draft Map{skeletons.length > 0 ? ` · ${skeletons.length} clusters` : ''}</Text>
            </div>
            <div className="flex flex-row items-center gap-2">
              <div className="inline-flex rounded border border-border overflow-hidden">
                <button type="button" onClick={() => setDraftMapColorMode('cluster')}
                  className={['px-2 py-1 text-xs font-medium transition-colors border-r border-border', draftMapColorMode === 'cluster' ? 'bg-link text-white' : 'bg-bg-accent hover:bg-bg-active text-text-secondary'].join(' ')}>
                  Cluster
                </button>
                <button type="button" onClick={() => setDraftMapColorMode('deckColor')}
                  className={['px-2 py-1 text-xs font-medium transition-colors', draftMapColorMode === 'deckColor' ? 'bg-link text-white' : 'bg-bg-accent hover:bg-bg-active text-text-secondary'].join(' ')}>
                  Deck Color
                </button>
              </div>
            </div>
          </div>
          {showAdvancedClustering && (
            <>
              <p className="text-xs text-text-secondary leading-snug max-w-2xl">
                <span>
                  Uses Leiden community detection on the draft similarity graph. <strong>Resolution</strong> controls
                  granularity; higher values produce more, smaller clusters. <span className="opacity-60"><strong>Neighbors (k)</strong> controls graph connectivity; higher values produce smoother boundaries.</span>
                </span>
              </p>
              <div className="flex flex-row flex-wrap items-end gap-3">
                <div className="flex flex-col gap-0.5">
                  <label className="text-[11px] font-medium text-text-secondary">Neighbors (k)</label>
                  <NumericInput min={5} max={200} value={pendingKnnK} onChange={setPendingKnnK} className="w-20" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[11px] font-medium text-text-secondary">Resolution</label>
                  <NumericInput min={0.1} max={10} step={0.1} value={pendingResolution} onChange={setPendingResolution} className="w-20" />
                </div>
                <button type="button" disabled={clusteringInProgress} onClick={() => { setSelectedSkeletonId(null); setFocusedPoolIndex(null); applyPendingClusteringSettings(); }}
                  className={['ml-auto self-end px-3 py-1.5 rounded text-xs font-semibold border transition-colors whitespace-nowrap', clusteringInProgress ? 'bg-bg-accent border-border text-text-secondary cursor-wait' : 'bg-link border-link text-white hover:opacity-90'].join(' ')}>
                  {clusteringInProgress ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {clusteringPhase ?? 'Clustering…'}
                    </span>
                  ) : 'Update clusters'}
                </button>
              </div>
            </>
          )}
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-2 gap-6 items-start">
          <div className={`relative ${showDraftMapScopePanel ? '' : 'col-span-2'}`}
            style={{ aspectRatio: '1 / 1', width: showDraftMapScopePanel ? '100%' : 'calc(50% - 0.75rem)', ...(!showDraftMapScopePanel ? { margin: '0 auto' } : {}) }}>
            {clusteringInProgress && (
              <div className={`${draftMapPoints.length === 0 ? '' : 'absolute inset-0 bg-bg/60 backdrop-blur-sm'} z-10 flex items-center justify-center rounded`}
                style={draftMapPoints.length === 0 ? { aspectRatio: '1 / 1' } : undefined}>
                <div className="flex flex-col items-center gap-2">
                  <svg className="animate-spin h-8 w-8 text-link" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <Text xs className="text-text-secondary">{clusteringPhase ?? 'Clustering…'}</Text>
                </div>
              </div>
            )}
            {!clusteringInProgress && draftMapPoints.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center rounded border border-dashed border-border bg-bg-accent/30">
                <div className="flex flex-col items-center gap-1.5 px-4 text-center">
                  <Text sm semibold className="text-text-secondary">
                    Draft map unavailable
                  </Text>
                  <Text xs className="text-text-secondary/70">
                    Try reclustering this run.
                  </Text>
                </div>
              </div>
            )}
            {draftMapPoints.length > 0 && (
              <DraftMapScatter
                points={draftMapPoints}
                selectedPoolIndex={focusedPoolIndex}
                activePoolIndexSet={activeFilterPoolIndexSet}
                colorMode={draftMapColorMode}
                onSelectPoint={(point) => {
                  setFocusedPoolIndex(point.poolIndex);
                  setSelectedSkeletonId(point.clusterId);
                  setSelectedArchetype(null);
                  setDraftBreakdownOpen(true);
                }}
              />
            )}
          </div>
          {showDraftMapScopePanel && (() => {
            const cardInfo: MapSelectedCardInfo | undefined = mapPanelHasBoth && selectedCards.length > 0
              ? {
                  cardImages: selectedCards
                    .map((c) => ({ oracleId: c.oracle_id, name: c.name, imageUrl: displayRunData.cardMeta[c.oracle_id]?.imageUrl ?? '' }))
                    .filter((img) => img.imageUrl),
                  name: selectedCards.map((c) => c.name).join(' + '),
                  pickRate: selectedCards.length === 1 ? (statsForScope?.pickRate ?? selectedCard?.pickRate) : undefined,
                  avgPickPosition: selectedCards.length === 1 ? (statsForScope?.avgPickPosition ?? selectedCard?.avgPickPosition) : undefined,
                  onClear: onClearSelectedCards,
                }
              : undefined;
            return (
              <div className="min-w-0 flex flex-col gap-3">
                {!mapPanelHasBoth && selectedCards.length > 0 && (
                  <div className="rounded-lg border border-border bg-bg-accent/40 px-3 py-2.5">
                    <Flexbox direction="row" gap="3" alignItems="start" className="min-w-0">
                      {selectedCard && displayRunData.cardMeta[selectedCard.oracle_id]?.imageUrl && (
                        <div className="flex-shrink-0">
                          <LinkedCardImage
                            oracleId={selectedCard.oracle_id}
                            name={selectedCard.name}
                            imageUrl={displayRunData.cardMeta[selectedCard.oracle_id].imageUrl}
                            size={SIM_PREVIEW_CARD_W}
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <Text semibold className="leading-snug">
                          {selectedCards.map((c) => c.name).join(' + ')}
                        </Text>
                        {selectedCardScopeLabel && (
                          <div className="mt-0.5">
                            <Text xs className="text-text-secondary/80">{detailedViewTitle}</Text>
                          </div>
                        )}
                        <div className="mt-0.5">
                          <Text xs className="text-text-secondary/60">{detailedViewSubtitle}</Text>
                        </div>
                        {statsForScope && (
                          <Flexbox direction="row" gap="3" alignItems="center" className="flex-wrap mt-1.5">
                            <span className="text-xs text-text-secondary/50 font-medium">
                              Pick rate <span className="text-text-secondary/80">{`${(statsForScope.pickRate * 100).toFixed(1)}%`}</span>
                            </span>
                            <span className="text-xs text-text-secondary/50 font-medium">
                              Avg position <span className="text-text-secondary/80">{statsForScope.avgPickPosition > 0 ? statsForScope.avgPickPosition.toFixed(1) : '—'}</span>
                            </span>
                          </Flexbox>
                        )}
                      </div>
                      <button type="button" className="flex-shrink-0 text-xs text-text-secondary hover:text-text" onClick={onClearSelectedCards}>
                        ✕
                      </button>
                    </Flexbox>
                  </div>
                )}
                {selectedSkeletonId !== null ? (() => {
                  const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
                  const skIdx = skeletons.indexOf(sk!);
                  const clusterDecks = sk && activeDecks ? sk.poolIndices.map((i) => activeDecks[i]).filter(Boolean) : null;
                  return sk ? (
                    <ClusterDetailPanel
                      skeleton={sk}
                      clusterIndex={skIdx}
                      totalPools={displayRunData.slimPools.length}
                      clusterDeckBuilds={clusterDecks}
                      cubeOracleSet={cubeOracleSet}
                      cardMeta={displayRunData.cardMeta}
                      commonCards={activeFilterPreview?.commonCards ?? []}
                      slimPools={displayRunData.slimPools}
                      deckBuilds={activeDecks}
                      themes={clusterThemesByClusterId.get(sk.clusterId)}
                      poolArchetypeLabels={poolArchetypeLabels}
                      onOpenPool={(poolIndex) => {
                        setSelectedSkeletonId(null);
                        setFocusedPoolIndex(poolIndex);
                        setDraftBreakdownOpen(true);
                      }}
                      onClose={() => {
                        setSelectedSkeletonId(null);
                        setFocusedPoolIndex(null);
                      }}
                    />
                  ) : null;
                })() : activeFilterPoolIndexSet !== null && (
                  <DraftMapScopePanel
                    title={cardInfo ? (scopeOnlySummary ?? '') : (activeFilterSummary ?? 'All draft pools')}
                    subtitle={draftMapScopeSubtitle}
                    commonCards={activeFilterPreview?.commonCards ?? []}
                    deckBuilds={filteredDecks}
                    cardMeta={displayRunData.cardMeta}
                    selectedCardInfo={cardInfo}
                    matchingCount={draftMapScopeSeatCount}
                  />
                )}
              </div>
            );
          })()}
        </div>
      </CardBody>
    </Card>
  );
};

const BOTTOM_TABS: { key: DraftSimulatorBottomTab; label: string }[] = [
  { key: 'archetypes', label: 'Archetypes' },
  { key: 'deckColor', label: 'Deck Color Distribution' },
  { key: 'cardStats', label: 'Card Stats' },
  { key: 'draftBreakdown', label: 'Draft Breakdown' },
  { key: 'sideboardAndPairings', label: 'Sideboard & Pairings' },
  { key: 'overperformers', label: 'Over/Underperformers' },
];

const FilterChipButtons: React.FC<{
  chips: ReturnType<typeof useDraftSimulatorPresentation>['filterChipItems'];
  includeFocus?: boolean;
}> = ({ chips, includeFocus = false }) => (
  <>
    {chips
      .filter((chip) => includeFocus || !chip.key.startsWith('focus-'))
      .map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onClear}
          className="inline-flex items-center gap-1 rounded bg-link/10 border border-link/20 px-2 py-0.5 text-xs text-link hover:bg-link/20"
          title={`Clear ${chip.label}`}
        >
          {chip.label}
          <span className="opacity-60">×</span>
        </button>
      ))}
  </>
);

const DraftSimulatorBottomSection: React.FC<{
  bottomTab: DraftSimulatorBottomTab;
  setBottomTab: React.Dispatch<React.SetStateAction<DraftSimulatorBottomTab>>;
  displayRunData: SimulationRunData;
  clusteringInProgress: boolean;
  clusteringPhase: string | null;
  skeletons: ArchetypeSkeleton[];
  selectedSkeletonId: number | null;
  setSelectedSkeletonId: React.Dispatch<React.SetStateAction<number | null>>;
  clusterThemesByClusterId: Map<number, string[]>;
  poolArchetypeLabels: Map<number, string> | null;
  poolArchetypeLabelsLoading: boolean;
  skeletonColorProfiles: Map<number, string>;
  selectedArchetype: string | null;
  setSelectedArchetype: React.Dispatch<React.SetStateAction<string | null>>;
  displayedArchetypeDistribution: ArchetypeEntry[];
  colorPairTopArchetypes: Map<string, string[]>;
  clearActiveFilter: () => void;
  activeFilterPoolIndexSet: Set<number> | null;
  hasApproximateFilteredStats: boolean;
  scopedCardStatsTitle: string;
  draftBreakdownTitle: string;
  sideboardTitle: string;
  pairingsTitle: string;
  overperformersTitleSuffix: string | null;
  downloadCardStatsCsv: (stats: CardStats[], label: string) => void;
  visibleCardStats: CardStats[];
  handleToggleSelectedCard: (oracleId: string) => void;
  selectedCardOracles: string[];
  inDeckOracles: Set<string> | null;
  inSideboardOracles: Set<string> | null;
  deckInclusionPct: Map<string, number>;
  visiblePoolCounts: Map<string, number>;
  cardStatsRef: React.RefObject<HTMLDivElement>;
  detailedViewRef: React.RefObject<HTMLDivElement>;
  downloadDraftBreakdownCsv: (pools: SimulatedPool[], label: string) => void;
  displayedPools: SimulatedPool[];
  activeDecks: BuiltDeck[] | null;
  simPhase: 'setup' | 'loadmodel' | 'sim' | 'deckbuild' | 'save' | null;
  focusedPoolViewMode: PoolViewMode;
  setFocusedPoolViewMode: React.Dispatch<React.SetStateAction<PoolViewMode>>;
  selectedCard: CardStats | null;
  focusedPoolIndex: number | null;
  setFocusedPoolIndex: React.Dispatch<React.SetStateAction<number | null>>;
  allPoolClusterThemes?: Map<number, { tag: string; lift: number }[]>;
  allPoolTagAllowlist?: Set<string>;
  topSideboardCards: ReturnType<typeof useDraftSimulatorSelection>['topSideboardCards'];
  topCardPairings: ReturnType<typeof useDraftSimulatorSelection>['topCardPairings'];
  pairingsExcludeLands: boolean;
  setPairingsExcludeLands: React.Dispatch<React.SetStateAction<boolean>>;
  status: 'idle' | 'running' | 'completed' | 'failed';
}> = ({
  bottomTab,
  setBottomTab,
  displayRunData,
  clusteringInProgress,
  clusteringPhase,
  skeletons,
  selectedSkeletonId,
  setSelectedSkeletonId,
  clusterThemesByClusterId,
  poolArchetypeLabels,
  poolArchetypeLabelsLoading,
  skeletonColorProfiles,
  selectedArchetype,
  setSelectedArchetype,
  displayedArchetypeDistribution,
  colorPairTopArchetypes,
  clearActiveFilter,
  activeFilterPoolIndexSet,
  hasApproximateFilteredStats,
  scopedCardStatsTitle,
  draftBreakdownTitle,
  sideboardTitle,
  pairingsTitle,
  overperformersTitleSuffix,
  downloadCardStatsCsv,
  visibleCardStats,
  handleToggleSelectedCard,
  selectedCardOracles,
  inDeckOracles,
  inSideboardOracles,
  deckInclusionPct,
  visiblePoolCounts,
  cardStatsRef,
  detailedViewRef,
  downloadDraftBreakdownCsv,
  displayedPools,
  activeDecks,
  simPhase,
  focusedPoolViewMode,
  setFocusedPoolViewMode,
  selectedCard,
  focusedPoolIndex,
  setFocusedPoolIndex,
  allPoolClusterThemes,
  allPoolTagAllowlist,
  topSideboardCards,
  topCardPairings,
  pairingsExcludeLands,
  setPairingsExcludeLands,
  status,
}) => (
  <div className="simSection simSectionBottomTabs flex flex-col gap-0 pt-3 border-t border-border">
    {activeFilterPoolIndexSet !== null && activeFilterPoolIndexSet.size === 0 && (
      <div className="rounded-lg border border-yellow-500 bg-yellow-500/10 px-4 py-3 mb-3 flex items-center justify-between gap-3">
        <Text sm className="text-text">
          No draft pools match the current combination of filters.
        </Text>
        <button
          type="button"
          className="text-xs text-text border border-yellow-500 rounded px-2 py-0.5 hover:bg-yellow-500/20 flex-shrink-0"
          onClick={clearActiveFilter}
        >
          Clear filters
        </button>
      </div>
    )}
    <div className="flex flex-row items-stretch gap-0 border-b border-border mb-4">
      {BOTTOM_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => setBottomTab(tab.key)}
          className={[
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            bottomTab === tab.key
              ? 'border-link text-link'
              : 'border-transparent text-text-secondary hover:text-text hover:border-border',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
    {bottomTab === 'archetypes' && (
      <div className="flex flex-col gap-4">
        {clusteringInProgress ? (
          <div className="flex flex-col gap-3 py-2">
            {clusteringPhase && (
              <Text xs className="text-text-secondary text-center">{clusteringPhase}</Text>
            )}
            {[100, 80, 90, 70, 85].map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-full bg-bg-accent" />
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="h-3 animate-pulse rounded bg-bg-accent" style={{ width: `${w}%` }} />
                  <div className="h-2.5 animate-pulse rounded bg-bg-accent" style={{ width: `${w * 0.6}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : skeletons.length > 0 ? (
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
          />
        ) : (
          <Text sm className="text-text-secondary">
            No archetypes found. Try lowering the minimum cluster size.
          </Text>
        )}
      </div>
    )}
    {bottomTab === 'deckColor' && (
      <div className="flex flex-col gap-4">
        <Card className="border-border">
          <CardHeader>
            <Flexbox direction="row" justify="between" alignItems="center" className="flex-wrap gap-2">
              <div>
                <Text semibold>Deck Color Distribution</Text>
                <div className="mt-0.5">
                  <Text xs className="text-text-secondary">
                    Click a row to filter stats by color profile
                  </Text>
                </div>
              </div>
              {selectedArchetype && (
                <Flexbox direction="row" gap="2" alignItems="center">
                  <span className="text-xs bg-link/20 text-link border border-link/30 rounded px-2 py-0.5">
                    {archetypeFullName(selectedArchetype)}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-text-secondary hover:text-text border border-border rounded px-2 py-0.5 hover:bg-bg-active"
                    onClick={() => setSelectedArchetype(null)}
                  >
                    ✕ Clear
                  </button>
                </Flexbox>
              )}
            </Flexbox>
          </CardHeader>
          <CardBody>
            <ArchetypeChart
              archetypeDistribution={displayedArchetypeDistribution}
              selectedArchetype={selectedArchetype}
              onSelect={(cp) => {
                setSelectedArchetype(cp);
                setSelectedSkeletonId(null);
              }}
              topArchetypesByColor={colorPairTopArchetypes}
            />
          </CardBody>
        </Card>
      </div>
    )}
    {bottomTab === 'cardStats' && (
      <div ref={cardStatsRef} className="flex flex-col gap-5">
        {hasApproximateFilteredStats && (
          <div className="rounded-lg border border-yellow-500 bg-yellow-500/10 px-4 py-3">
            <Text sm className="text-text">
              Exact card-stat filtering isn't available for this run — re-simulate to get precise per-filter stats.
              Deck and draft breakdowns are filtered correctly; card-level stats reflect the full run.
            </Text>
          </div>
        )}
        <Card className="border-border">
          <CardHeader>
            <Flexbox direction="row" gap="2" alignItems="center" justify="between" className="flex-wrap">
              <Text semibold>{scopedCardStatsTitle}</Text>
              <div className="flex items-center gap-2 flex-shrink-0">
                {activeFilterPoolIndexSet && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-bg-active hover:text-text"
                    onClick={() => downloadCardStatsCsv(visibleCardStats, 'filtered')}
                    title="Download filtered card stats as CSV"
                  >
                    ↓ Export (filtered)
                  </button>
                )}
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-bg-active hover:text-text"
                  onClick={() => downloadCardStatsCsv(displayRunData.cardStats, 'all')}
                  title="Download all card stats as CSV"
                >
                  ↓ Export
                </button>
              </div>
            </Flexbox>
          </CardHeader>
          <CardBody>
            <CardStatsTable
              cardStats={visibleCardStats}
              cardMeta={displayRunData.cardMeta}
              onSelectCard={handleToggleSelectedCard}
              selectedCardOracles={selectedCardOracles}
              inDeckOracles={inDeckOracles}
              inSideboardOracles={inSideboardOracles}
              deckInclusionPct={deckInclusionPct}
              visiblePoolCounts={visiblePoolCounts}
              renderCardLink={renderAutocardNameLink}
              onPageChange={() => cardStatsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            />
          </CardBody>
        </Card>
      </div>
    )}
    {bottomTab === 'draftBreakdown' && (
      <div ref={detailedViewRef} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Text semibold>{draftBreakdownTitle}</Text>
          <div className="flex items-center gap-2 flex-shrink-0">
            {activeFilterPoolIndexSet && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-bg-active hover:text-text"
                onClick={() =>
                  downloadDraftBreakdownCsv(displayedPools.filter((p) => activeFilterPoolIndexSet.has(p.poolIndex)), 'filtered')
                }
                title="Download filtered draft breakdown as CSV"
              >
                ↓ Export (filtered)
              </button>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-bg-active hover:text-text"
              onClick={() => downloadDraftBreakdownCsv(displayedPools, 'all')}
              title="Download all draft breakdown as CSV"
            >
              ↓ Export
            </button>
          </div>
        </div>
        <DraftBreakdownTable
          pools={activeFilterPoolIndexSet !== null ? displayedPools.filter((p) => activeFilterPoolIndexSet.has(p.poolIndex)) : displayedPools}
          deckBuilds={activeDecks}
          deckLoading={simPhase === 'deckbuild'}
          cardMeta={displayRunData.cardMeta}
          runData={displayRunData}
          skeletons={skeletons}
          viewMode={focusedPoolViewMode}
          setViewMode={setFocusedPoolViewMode}
          highlightOracle={selectedCard?.oracle_id}
          showLocationFilter={!!selectedCard}
          selectedCardName={selectedCard?.name}
          focusedPoolIndex={focusedPoolIndex}
          onSelectPool={setFocusedPoolIndex}
          poolArchetypeLabels={poolArchetypeLabels}
          poolArchetypeLabelsLoading={poolArchetypeLabelsLoading}
          clusterThemes={allPoolClusterThemes}
          clusterTagAllowlist={allPoolTagAllowlist}
        />
      </div>
                  )}
                  {bottomTab === 'overperformers' && (
                    <div className="flex flex-col gap-4">
                      <DraftVsEloTable
                        cardStats={visibleCardStats}
                        inDeckOracles={inDeckOracles}
                        titleSuffix={overperformersTitleSuffix}
                        renderCardLink={(oracleId, name) => renderAutocardNameLink(oracleId, name)}
                      />
                    </div>
                  )}
    {bottomTab === 'sideboardAndPairings' && (
      <Row className="gap-4">
        <Col xs={12} md={6}>
          <div className="h-full rounded border border-border bg-bg">
            <div className="border-b border-border bg-bg-accent/50 px-3 py-2 flex flex-col gap-0.5">
              <Text semibold>{sideboardTitle}</Text>
              <Text xs className="text-text-secondary">Cards most often left in the sideboard across matching pools.</Text>
            </div>
            {topSideboardCards.length === 0 ? (
              <div className="px-3 py-3">
                <Text sm className="text-text-secondary">
                  {simPhase === 'deckbuild' || (!activeDecks && status === 'running')
                    ? 'Building decks…'
                    : 'No sideboard data available for the current filter.'}
                </Text>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-sm" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col />
                    <col style={{ width: 60 }} />
                    <col style={{ width: 72 }} />
                  </colgroup>
                  <thead className="bg-bg-accent/50 border-b border-border">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">Card</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-text-secondary">Pools</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-text-secondary">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topSideboardCards.map((entry) => {
                      const meta = displayRunData.cardMeta[entry.oracle_id];
                      return (
                        <tr key={entry.oracle_id} className="hover:bg-bg-accent/40">
                          <td className="px-3 py-2 font-medium text-text truncate">
                            {meta ? renderAutocardNameLink(entry.oracle_id, meta.name, meta.imageUrl) : entry.oracle_id}
                          </td>
                          <td className="px-3 py-2 text-right text-text-secondary">{entry.count}</td>
                          <td className="px-3 py-2 text-right text-text-secondary">{(entry.pct * 100).toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Col>
        <Col xs={12} md={6}>
          <div className="h-full rounded border border-border bg-bg">
            <div className="border-b border-border bg-bg-accent/50 px-3 py-2 flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <Text semibold>{pairingsTitle}</Text>
                <Text xs className="text-text-secondary">Pairs of cards most often drafted together into the same deck.</Text>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer select-none flex-shrink-0 pt-0.5">
                <input
                  type="checkbox"
                  checked={pairingsExcludeLands}
                  onChange={(e) => setPairingsExcludeLands(e.target.checked)}
                  className="rounded"
                />
                Exclude lands
              </label>
            </div>
            {topCardPairings.length === 0 ? (
              <div className="px-3 py-3">
                <Text sm className="text-text-secondary">
                  {simPhase === 'deckbuild' || (!activeDecks && status === 'running')
                    ? 'Building decks…'
                    : 'No pairing data available for the current filter.'}
                </Text>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-sm" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 48 }} />
                    <col />
                    <col style={{ width: 48 }} />
                    <col />
                    <col style={{ width: 60 }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 80 }} />
                  </colgroup>
                  <thead className="bg-bg-accent/50 border-b border-border">
                    <tr>
                      <th className="px-2 py-2" />
                      <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">Card A</th>
                      <th className="px-2 py-2" />
                      <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">Card B</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-text-secondary">Pools</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-text-secondary" title="% of decks containing both cards">% decks</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-text-secondary" title="% of decks with the rarer card that also have the other">Given rarer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topCardPairings.map((entry) => {
                      const metaA = displayRunData.cardMeta[entry.oracle_id_a ?? ''];
                      const metaB = displayRunData.cardMeta[entry.oracle_id_b ?? ''];
                      const artA = metaA?.imageUrl?.replace('/normal/', '/art_crop/') ?? '';
                      const artB = metaB?.imageUrl?.replace('/normal/', '/art_crop/') ?? '';
                      return (
                        <tr key={`${entry.oracle_id_a}|${entry.oracle_id_b}`} className="hover:bg-bg-accent/40">
                          <td className="px-2 py-1">
                            {artA && (
                              <div className="overflow-hidden rounded" style={{ width: 36, height: 36 }}>
                                <img src={artA} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium text-text truncate">
                            {metaA ? renderAutocardNameLink(entry.oracle_id_a!, metaA.name, metaA.imageUrl) : entry.oracle_id_a}
                          </td>
                          <td className="px-2 py-1">
                            {artB && (
                              <div className="overflow-hidden rounded" style={{ width: 36, height: 36 }}>
                                <img src={artB} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium text-text truncate">
                            {metaB ? renderAutocardNameLink(entry.oracle_id_b!, metaB.name, metaB.imageUrl) : entry.oracle_id_b}
                          </td>
                          <td className="px-3 py-2 text-right text-text-secondary">{entry.count}</td>
                          <td className="px-3 py-2 text-right text-text-secondary">{(entry.rawPct * 100).toFixed(1)}%</td>
                          <td className="px-3 py-2 text-right text-text-secondary">{(entry.pct * 100).toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Col>
      </Row>
    )}
    <Text xs className="text-text-secondary text-right mt-4">
      Generated {new Date(displayRunData.generatedAt).toLocaleString()}
    </Text>
  </div>
);

const ArchetypeSkeletonSection: React.FC<{
  skeletons: ArchetypeSkeleton[];
  totalPools: number;
  selectedSkeletonId: number | null;
  onSelectSkeleton: (id: number | null) => void;
  clusterThemesByClusterId?: Map<number, string[]>;
  poolArchetypeLabels?: Map<number, string> | null;
  poolArchetypeLabelsLoading?: boolean;
  skeletonColorProfiles?: Map<number, string>;
}> = ({ skeletons, totalPools, selectedSkeletonId, onSelectSkeleton, clusterThemesByClusterId, poolArchetypeLabels, poolArchetypeLabelsLoading, skeletonColorProfiles }) => (
  <ArchetypeSkeletonSectionInner
    skeletons={skeletons}
    totalPools={totalPools}
    selectedSkeletonId={selectedSkeletonId}
    onSelectSkeleton={onSelectSkeleton}
    clusterThemesByClusterId={clusterThemesByClusterId}
    poolArchetypeLabels={poolArchetypeLabels}
    poolArchetypeLabelsLoading={poolArchetypeLabelsLoading}
    skeletonColorProfiles={skeletonColorProfiles}
  />
);

const ArchetypeSkeletonSectionInner: React.FC<{
  skeletons: ArchetypeSkeleton[];
  totalPools: number;
  selectedSkeletonId: number | null;
  onSelectSkeleton: (id: number | null) => void;
  clusterThemesByClusterId?: Map<number, string[]>;
  poolArchetypeLabels?: Map<number, string> | null;
  poolArchetypeLabelsLoading?: boolean;
  skeletonColorProfiles?: Map<number, string>;
}> = ({ skeletons, totalPools, selectedSkeletonId, onSelectSkeleton, clusterThemesByClusterId, poolArchetypeLabels, poolArchetypeLabelsLoading, skeletonColorProfiles = new Map() }) => {

  const renderSkeleton = (skeleton: ArchetypeSkeleton, skIdx: number) => {
    // Compute dominant Gwen archetype label for this cluster
    const dominantArchetype = (() => {
      if (!poolArchetypeLabels) return null;
      const counts = new Map<string, number>();
      for (const pi of skeleton.poolIndices) {
        const label = poolArchetypeLabels.get(pi);
        if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
      }
      if (counts.size === 0) return null;
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    })();

    return (
    <div
      key={skeleton.clusterId}
      className={[
        'grid grid-cols-[8.5rem_minmax(0,1fr)] gap-2 bg-bg px-2 py-1.5 items-center sm:grid-cols-[12rem_minmax(0,1fr)] md:grid-cols-[15rem_minmax(0,1fr)]',
        selectedSkeletonId === skeleton.clusterId ? 'bg-link/5' : '',
      ].join(' ')}
    >
      <button
        type="button"
        className="flex h-full flex-col justify-center rounded-md px-2 py-1 text-left hover:bg-bg-active"
        onClick={() => onSelectSkeleton(selectedSkeletonId === skeleton.clusterId ? null : skeleton.clusterId)}
      >
        <div className="flex flex-col gap-0.5 text-sm">
          <span className="text-[10px] text-text-secondary uppercase tracking-wider">Cluster {skIdx + 1}</span>
          <span className="font-semibold tracking-tight">
            {dominantArchetype ? (
              `${skeletonColorProfiles.get(skeleton.clusterId) && skeletonColorProfiles.get(skeleton.clusterId) !== 'C' ? `${skeletonColorProfiles.get(skeleton.clusterId)} ` : ''}${dominantArchetype}`
            ) : poolArchetypeLabelsLoading ? (
              <span className="inline-block h-4 w-28 animate-pulse rounded bg-bg-accent align-middle" />
            ) : (
              getSkeletonDisplayName(skeleton, poolArchetypeLabels, skeletonColorProfiles)
            )}
          </span>
          <span className="text-xs text-text-secondary">
            {skeleton.poolCount} seats · {((skeleton.poolCount / totalPools) * 100).toFixed(1)}%
          </span>
          {clusterThemesByClusterId?.get(skeleton.clusterId)?.map((theme) => (
            <span
              key={theme}
              className="inline-flex w-fit text-[10px] bg-bg-accent border border-border/60 rounded px-1.5 py-0.5 text-text-secondary"
            >
              {theme}
            </span>
          ))}
          {selectedSkeletonId === skeleton.clusterId && (
            <span className="inline-flex w-fit text-xs bg-link/20 text-link border border-link/30 rounded px-2 py-0.5">
              Filtering
            </span>
          )}
        </div>
      </button>
      {skeleton.coreCards.length > 0 ? (
        <div className="min-w-0 flex flex-row flex-wrap gap-1">
          {skeleton.coreCards.slice(0, 8).map((card) => (
            <SkeletonCardImage key={card.oracle_id} card={card} size={128} />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-border/70 bg-bg-accent/30 px-3 py-2">
          <Text sm className="text-text-secondary">
            No shared cards were found for this cluster.
          </Text>
        </div>
      )}
    </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Text semibold>Archetypes</Text>
          </div>
          <Text xs className="text-text-secondary">
            Grouped by shared cards
          </Text>
        </div>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="3">
          <div className="overflow-hidden rounded-lg border border-border/80 divide-y divide-border/70">
            {skeletons.map((skeleton, idx) => renderSkeleton(skeleton, idx))}
          </div>
        </Flexbox>
      </CardBody>
    </Card>
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

  // Controls
  const [numDrafts, setNumDrafts] = useState(100);
  const [numSeats, setNumSeats] = useState(8);
  const [gpuBatchSize, setGpuBatchSize] = useState(32);
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
      ...(cube.formats ?? []).map((format, index) => ({
        value: `${index}`,
        label: format.title || `Format ${index + 1}`,
      })),
    ],
    [cube.formats],
  );

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
        ? computeDraftMapPoints(displayRunData.slimPools, displayedPools, skeletons, umapCoords, poolArchetypeLabels, skeletonColorProfiles)
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
                    Simulate bot-only drafts to estimate pick rates, color trends, and archetype outcomes. Results are stored locally on this device.
                  </Text>
                </div>
              </CardHeader>
              <CardBody className="pt-3">
                {/* Controls grid — 5 fields + CTA as sixth column */}
                <div
                  className="grid gap-3 items-end"
                  style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr)) auto' }}
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
                <div className="simSection simSectionOverview flex flex-col gap-4">
                  <div className="simSectionHeading flex items-center justify-between gap-3">
                    <Text semibold className="tracking-wide">
                      Simulation Overview
                    </Text>
                    <button
                      type="button"
                      onClick={() => setOverviewOpen((open) => !open)}
                      className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active"
                    >
                      {overviewOpen ? '▲ Hide' : '▼ Show'}
                    </button>
                  </div>
                  <Collapse isOpen={overviewOpen}>
                    <Flexbox direction="row" gap="4" className="flex-wrap items-stretch">
                      <div className="flex flex-col gap-4 flex-shrink-0" style={{ width: 200 }}>
                        <SummaryCard
                          label="Drafts Simulated"
                          value={displayRunData.numDrafts}
                          sub={`${displayRunData.numSeats} seats each`}
                        />
                        <SummaryCard
                          label="Cards Tracked"
                          value={displayRunData.cardStats.length}
                          sub="unique cards seen across all packs"
                        />
                      </div>
                      <div className="flex-1 min-w-[180px]">
                        <Card className="h-full">
                          <CardBody className="py-3">
                            <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-2">
                              Deck Color Share
                            </Text>
                            {!activeDecks ? (
                              <OverviewChartSpinner />
                            ) : (
                              <DeckColorShareChart deckBuilds={activeDecks} cardMeta={displayRunData.cardMeta} />
                            )}
                          </CardBody>
                        </Card>
                      </div>
                      <div className="flex-1 min-w-[180px]">
                        <Card className="h-full">
                          <CardBody className="py-3">
                            <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-2">
                              Card Types
                            </Text>
                            {!activeDecks ? (
                              <OverviewChartSpinner />
                            ) : (
                              <CardTypeShareChart deckBuilds={activeDecks} cardMeta={displayRunData.cardMeta} />
                            )}
                          </CardBody>
                        </Card>
                      </div>
                      <div className="flex-1 min-w-[180px] flex flex-col gap-3">
                        <Card className="h-full">
                          <CardBody className="py-3">
                            <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-2">
                              Mana Curve Share
                            </Text>
                            {!activeDecks ? (
                              <OverviewChartSpinner />
                            ) : (
                              <ManaCurveShareChart deckBuilds={activeDecks} cardMeta={displayRunData.cardMeta} />
                            )}
                          </CardBody>
                        </Card>
                        <Card className="h-full">
                          <CardBody className="py-3">
                            <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-2">
                              Elo Distribution
                            </Text>
                            {!activeDecks ? (
                              <OverviewChartSpinner />
                            ) : (
                              <EloDistributionChart deckBuilds={activeDecks} cardMeta={displayRunData.cardMeta} />
                            )}
                          </CardBody>
                        </Card>
                      </div>
                    </Flexbox>
                  </Collapse>
                </div>
                <div className="simSection simSectionCards flex flex-col gap-5 pt-2">
                  <Flexbox direction="col" gap="4">
                    <div className="simCardDiagBlock simCardDiagSummary flex flex-col gap-4">
                      {/* Draft Map — full width, with cluster detail panel on the right when selected */}
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
                        activeFilterSummary={activeFilterSummary}
                        scopeOnlySummary={scopeOnlySummary}
                        filteredDecks={filteredDecks}
                        draftMapScopeSubtitle={draftMapScopeSubtitle}
                        draftMapScopeSeatCount={draftMapScopeSeatCount}
                        onClearSelectedCards={() => setSelectedCardOracles([])}
                        cubeOracleSet={cubeOracleSet}
                      />
                    </div>
                  </Flexbox>
                </div>
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
                  renderSkeletonLabel={(skeleton) =>
                    getSkeletonDisplayName(skeleton, poolArchetypeLabels, skeletonColorProfiles)
                  }
                />
                {oovWarningPct !== null && (
                  <div className="rounded-lg border border-yellow-500 bg-yellow-500/10 px-4 py-3 mb-2">
                    <Text sm className="text-text">
                      {Math.round(oovWarningPct * 100)}% of cards in this cube aren't in the ML model's training
                      vocabulary. Pick simulation and deckbuilding quality may be reduced for those cards.
                    </Text>
                  </div>
                )}
                <DraftSimulatorBottomSection
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
                  focusedPoolViewMode={focusedPoolViewMode}
                  setFocusedPoolViewMode={setFocusedPoolViewMode}
                  selectedCard={selectedCard}
                  focusedPoolIndex={focusedPoolIndex}
                  setFocusedPoolIndex={setFocusedPoolIndex}
                  allPoolClusterThemes={allPoolClusterThemes}
                  allPoolTagAllowlist={allPoolTagAllowlist}
                  topSideboardCards={topSideboardCards}
                  topCardPairings={topCardPairings}
                  pairingsExcludeLands={pairingsExcludeLands}
                  setPairingsExcludeLands={setPairingsExcludeLands}
                  status={status}
                />
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
          process runs in four stages:
        </p>
        <ol className="list-decimal list-inside space-y-1.5 ml-2">
          <li>
            <span className="font-medium text-text">ML embeddings</span> — each main deck is encoded into a
            128-dimensional vector by the same neural-network draft model that powers bot picks. These vectors capture
            card synergies and strategic signals learned from real drafts. If the model isn't loaded, the system falls
            back to TF-IDF vectors (binary card presence weighted by rarity across pools).
          </li>
          <li>
            <span className="font-medium text-text">k-NN graph</span> — a k-nearest-neighbor graph connects each deck
            to its most similar neighbors using cosine distance. This shared graph drives both clustering and the Draft
            Map layout.
          </li>
          <li>
            <span className="font-medium text-text">Clustering</span> — the default method is{' '}
            <span className="font-medium text-text">Leiden</span>, which treats the k-NN graph as a social network and
            finds communities. Other methods are available in Advanced Options: HDBSCAN on the k-NN graph or a UMAP
            projection, and NMF (non-negative matrix factorization) which decomposes drafts into shared card themes.
          </li>
          <li>
            <span className="font-medium text-text">UMAP layout</span> — the k-NN graph is projected to 2D for the
            Draft Map scatter plot. Nearby points share similar deck structure; clusters appear as visible clumps.
          </li>
        </ol>
        <p>
          Each cluster is labeled with a human-readable archetype name derived from a pre-trained model of 496 known
          Magic archetypes. Each deck's embedding is compared to all archetype centroids via cosine similarity, and the
          nearest match becomes the label (e.g. "Izzet Spells", "Mono-Green Stompy").
        </p>
        <p>Each cluster panel shows:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>
            <span className="font-medium text-text">Common cards</span> — cards appearing most often across decks in
            the cluster
          </li>
          <li>
            <span className="font-medium text-text">Signature cards</span> — cards that appear significantly more in
            this cluster than in others (contrastive scoring vs. neighboring clusters)
          </li>
          <li>
            <span className="font-medium text-text">Core package</span> — the tightest co-drafted chain of cards
            linked by highest pairwise co-occurrence; the cards most likely to show up together in the same deck
          </li>
          <li>
            <span className="font-medium text-text">Card pockets</span> — sub-groups within the cluster: cards
            partitioned by co-occurrence into distinct packages (e.g. a removal suite vs. a synergy engine)
          </li>
          <li>
            <span className="font-medium text-text">Themes</span> — oracle-tag based theme labels (e.g. "Removal",
            "Spells Matter") computed by lift analysis: tags over-represented in this cluster vs. the global baseline
          </li>
          <li>
            <span className="font-medium text-text">Color share and mana curve</span> — color identity breakdown and
            CMC distribution of mainboard cards across the cluster
          </li>
        </ul>
        <p>
          The color label (e.g. "UR") is derived from actual deck color share — a color must represent at least 10% of
          mainboard card identity to appear in the label.
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
