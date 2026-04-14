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
  SimulationTimingBreakdown,
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
import { Scatter } from 'react-chartjs-2';

import Button from '../components/base/Button';
import { Card, CardBody, CardHeader } from '../components/base/Card';
import Collapse from '../components/base/Collapse';
import Input from '../components/base/Input';
import { Col, Flexbox, Row } from '../components/base/Layout';
import Link from '../components/base/Link';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../components/base/Modal';
import Select from '../components/base/Select';
import Text from '../components/base/Text';
import { DeckStacksStatic } from '../components/DeckCard';
import DraftBreakdownDisplay from '../components/draft/DraftBreakdownDisplay';
import DynamicFlash from '../components/DynamicFlash';
import ConfirmDeleteModal from '../components/modals/ConfirmDeleteModal';
import RenderToRoot from '../components/RenderToRoot';
import withAutocard from '../components/WithAutocard';
import { CSRFContext } from '../contexts/CSRFContext';
import { DisplayContextProvider } from '../contexts/DisplayContext';
import CubeLayout from '../layouts/CubeLayout';
import MainLayout from '../layouts/MainLayout';
import { modelScoresToProbabilities } from '../utils/botRatings';
import {
  buildOracleRemapping,
  DeckbuildEntry,
  encodePools,
  loadDraftBot,
  localBatchDeckbuild,
  localBatchDraftRanked,
  localPickBatch,
  reshapeEmbeddings,
  WebGLInferenceError,
} from '../utils/draftBot';
import { computeSkeletons } from '../utils/draftSimulatorClustering';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, ScatterController, Tooltip, Legend);

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

interface FilterChipItem {
  key: string;
  label: string;
  detail?: string;
  onClear: () => void;
}

const ActiveFilterBar: React.FC<{
  chips: FilterChipItem[];
  matchingPools: number;
  totalPools: number;
  cardStats: CardStats[];
  selectedCardOracles: string[];
  archetypeDistribution: ArchetypeEntry[];
  selectedArchetype: string | null;
  skeletons: ArchetypeSkeleton[];
  selectedSkeletonId: number | null;
  onAddCard: (oracleId: string) => void;
  onSelectArchetype: (archetype: string | null) => void;
  onSelectSkeleton: (clusterId: number | null) => void;
  onClearAll: () => void;
}> = ({
  chips,
  matchingPools,
  totalPools,
  cardStats,
  selectedCardOracles,
  archetypeDistribution,
  selectedArchetype,
  skeletons,
  selectedSkeletonId,
  onAddCard,
  onSelectArchetype,
  onSelectSkeleton,
  onClearAll,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [cardSearchValue, setCardSearchValue] = useState('');
  const hasFilters = chips.length > 0;
  const topColorProfiles = archetypeDistribution.slice(0, 8);
  const topSkeletons = skeletons.slice(0, 8);

  const handleAddCard = useCallback(() => {
    const trimmed = cardSearchValue.trim().toLowerCase();
    if (!trimmed) return;
    const match = cardStats.find(
      (card) => card.name.toLowerCase() === trimmed || card.oracle_id.toLowerCase() === trimmed,
    );
    if (!match) return;
    onAddCard(match.oracle_id);
    setCardSearchValue('');
  }, [cardSearchValue, cardStats, onAddCard]);

  return (
    <div className="sticky top-2 z-20 rounded-lg border border-border bg-bg shadow-md">
      <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Text semibold className="text-lg">
              Active Filters
            </Text>
            <span className="rounded bg-bg-accent px-2.5 py-1 text-xs text-text-secondary">
              {matchingPools}/{totalPools} seats
            </span>
          </div>
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2.5">
            {hasFilters ? (
              chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onClear}
                  className="inline-flex max-w-full items-center gap-1.5 rounded border border-border bg-bg-accent px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-active"
                  title={`Clear ${chip.label}`}
                >
                  {chip.detail && <span className="font-medium text-text-secondary/70">{chip.detail}</span>}
                  <span className="truncate">{chip.label}</span>
                  <span className="text-text-secondary/60">x</span>
                </button>
              ))
            ) : (
              <Text xs className="text-text-secondary">
                No active filters. Click a card, color profile, cluster, or map point to narrow the run.
              </Text>
            )}
          </div>
        </div>
        <div className="flex flex-row items-center gap-2">
          {hasFilters && (
            <button
              type="button"
              onClick={onClearAll}
              className="rounded border border-border bg-bg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-active"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            className="rounded border border-border bg-bg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-active"
          >
            {isOpen ? 'Hide filters' : 'Edit filters'}
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="grid gap-5 border-t border-border px-5 py-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Text xs className="mb-1.5 font-medium uppercase tracking-[0.14em] text-text-secondary/70">
              Cards
            </Text>
            <div className="flex gap-2">
              <input
                list="sim-filter-card-options"
                value={cardSearchValue}
                onChange={(event) => setCardSearchValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleAddCard();
                  }
                }}
                placeholder="Add card"
                className="min-w-0 flex-1 rounded border border-border bg-bg px-2 py-1 text-sm text-text"
              />
              <datalist id="sim-filter-card-options">
                {cardStats.map((card) => (
                  <option key={card.oracle_id} value={card.name} />
                ))}
              </datalist>
              <button
                type="button"
                onClick={handleAddCard}
                className="rounded border border-border bg-bg px-2 py-1 text-xs font-medium text-text-secondary hover:bg-bg-active"
              >
                Add
              </button>
            </div>
            <Text xs className="mt-1 text-text-secondary/70">
              Up to two card filters. Current: {selectedCardOracles.length}/2.
            </Text>
          </div>
          <div>
            <Text xs className="mb-1.5 font-medium uppercase tracking-[0.14em] text-text-secondary/70">
              Color
            </Text>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onSelectArchetype(null)}
                className={[
                  'rounded border px-2 py-1 text-xs font-medium',
                  selectedArchetype === null
                    ? 'border-link bg-link/10 text-link'
                    : 'border-border bg-bg text-text-secondary hover:bg-bg-active',
                ].join(' ')}
              >
                Any
              </button>
              {topColorProfiles.map((entry) => (
                <button
                  key={entry.colorPair}
                  type="button"
                  onClick={() => onSelectArchetype(selectedArchetype === entry.colorPair ? null : entry.colorPair)}
                  className={[
                    'rounded border px-2 py-1 text-xs font-medium',
                    selectedArchetype === entry.colorPair
                      ? 'border-link bg-link/10 text-link'
                      : 'border-border bg-bg text-text-secondary hover:bg-bg-active',
                  ].join(' ')}
                >
                  {archetypeFullName(entry.colorPair)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Text xs className="mb-1.5 font-medium uppercase tracking-[0.14em] text-text-secondary/70">
              Cluster
            </Text>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onSelectSkeleton(null)}
                className={[
                  'rounded border px-2 py-1 text-xs font-medium',
                  selectedSkeletonId === null
                    ? 'border-link bg-link/10 text-link'
                    : 'border-border bg-bg text-text-secondary hover:bg-bg-active',
                ].join(' ')}
              >
                Any
              </button>
              {topSkeletons.map((skeleton, index) => (
                <button
                  key={skeleton.clusterId}
                  type="button"
                  onClick={() =>
                    onSelectSkeleton(selectedSkeletonId === skeleton.clusterId ? null : skeleton.clusterId)
                  }
                  className={[
                    'rounded border px-2 py-1 text-xs font-medium',
                    selectedSkeletonId === skeleton.clusterId
                      ? 'border-link bg-link/10 text-link'
                      : 'border-border bg-bg text-text-secondary hover:bg-bg-active',
                  ].join(' ')}
                >
                  Cluster {index + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)} s`;
}

/** Number input that lets the user type freely; commits/clamps only on blur or Enter. */
const NumericInput: React.FC<{
  value: number;
  min: number;
  max?: number;
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
      value={draft}
      disabled={disabled}
      className={className}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const nextDraft = e.target.value;
        setDraft(nextDraft);
        const parsed = parseInt(nextDraft, 10);
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

const COLOR_FULL_NAMES: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
  C: 'Colorless',
};

function archetypeFullName(colorPair: string): string {
  if (!colorPair || colorPair === 'C') return 'Colorless';
  const parts = colorPair
    .split('')
    .filter((c) => c in COLOR_FULL_NAMES)
    .map((c) => COLOR_FULL_NAMES[c]!);
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

const LOCAL_SIM_HISTORY_LIMIT = 5;
const LOCAL_SIM_STORAGE_VERSION = 1;
const LOCAL_SIM_DB_NAME = 'cubecobra-draft-simulator';
const LOCAL_SIM_DB_VERSION = 1;
const LOCAL_SIM_STORE_NAME = 'runs';
const GPU_BATCH_OPTIONS = [
  { value: '16', label: '16 - conservative' },
  { value: '32', label: '32 - safe' },
  { value: '64', label: '64 - balanced' },
  { value: '128', label: '128 - strong GPU' },
];

interface LocalSimulationStore {
  version: number;
  runs: { entry: SimulationRunEntry; runData: SimulationRunData }[];
}

interface IndexedDbSimulationRunRecord {
  key: string;
  cubeId: string;
  ts: number;
  entry: SimulationRunEntry;
  runData: SimulationRunData;
}

const localSimulationStorageKey = (cubeId: string, ts: number): string => `${cubeId}:${ts}`;

async function openLocalSimulationDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    throw new Error('IndexedDB is not available in this browser');
  }
  return await new Promise((resolve, reject) => {
    const request = window.indexedDB.open(LOCAL_SIM_DB_NAME, LOCAL_SIM_DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOCAL_SIM_STORE_NAME)) {
        const store = db.createObjectStore(LOCAL_SIM_STORE_NAME, { keyPath: 'key' });
        store.createIndex('cubeId', 'cubeId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function readLocalSimulationStore(cubeId: string): Promise<LocalSimulationStore> {
  const db = await openLocalSimulationDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(LOCAL_SIM_STORE_NAME, 'readonly');
      const store = tx.objectStore(LOCAL_SIM_STORE_NAME);
      const request = store.index('cubeId').getAll(cubeId);
      request.onerror = () => reject(request.error ?? new Error('Failed to load local simulation history'));
      request.onsuccess = () => {
        const runs = (request.result as IndexedDbSimulationRunRecord[])
          .filter(
            (run): run is IndexedDbSimulationRunRecord =>
              !!run &&
              run.cubeId === cubeId &&
              typeof run.entry?.ts === 'number' &&
              typeof run.entry?.generatedAt === 'string' &&
              !!run.runData &&
              typeof run.runData.numDrafts === 'number',
          )
          .sort((a, b) => b.ts - a.ts)
          .slice(0, LOCAL_SIM_HISTORY_LIMIT)
          .map((run) => ({ entry: run.entry, runData: run.runData }));
        resolve({ version: LOCAL_SIM_STORAGE_VERSION, runs });
      };
    });
  } finally {
    db.close();
  }
}

async function writeLocalSimulationStore(
  cubeId: string,
  runs: { entry: SimulationRunEntry; runData: SimulationRunData }[],
): Promise<void> {
  const nextRuns = [...runs].sort((a, b) => b.entry.ts - a.entry.ts);
  const desiredKeys = new Set(
    nextRuns.slice(0, LOCAL_SIM_HISTORY_LIMIT).map((run) => localSimulationStorageKey(cubeId, run.entry.ts)),
  );
  const db = await openLocalSimulationDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(LOCAL_SIM_STORE_NAME, 'readwrite');
      const store = tx.objectStore(LOCAL_SIM_STORE_NAME);
      const existingReq = store.index('cubeId').getAll(cubeId);
      existingReq.onerror = () => reject(existingReq.error ?? new Error('Failed to write local simulation history'));
      existingReq.onsuccess = () => {
        const existing = existingReq.result as IndexedDbSimulationRunRecord[];
        for (const run of nextRuns.slice(0, LOCAL_SIM_HISTORY_LIMIT)) {
          store.put({
            key: localSimulationStorageKey(cubeId, run.entry.ts),
            cubeId,
            ts: run.entry.ts,
            entry: run.entry,
            runData: run.runData,
          } satisfies IndexedDbSimulationRunRecord);
        }
        for (const record of existing) {
          if (!desiredKeys.has(record.key)) {
            store.delete(record.key);
          }
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to write local simulation history'));
    });
  } finally {
    db.close();
  }
}

async function persistSimulationRun(
  cubeId: string,
  entry: SimulationRunEntry,
  runData: SimulationRunData,
): Promise<{ runs: SimulationRunEntry[]; persisted: boolean }> {
  const store = await readLocalSimulationStore(cubeId);
  const nextStoredRuns = [{ entry, runData }, ...store.runs.filter((run) => run.entry.ts !== entry.ts)];
  try {
    await writeLocalSimulationStore(cubeId, nextStoredRuns);
    const nextStore = await readLocalSimulationStore(cubeId);
    return { runs: nextStore.runs.map((run) => run.entry), persisted: true };
  } catch {
    try {
      await writeLocalSimulationStore(cubeId, [{ entry, runData }]);
      const nextStore = await readLocalSimulationStore(cubeId);
      return { runs: nextStore.runs.map((run) => run.entry), persisted: true };
    } catch {
      return { runs: store.runs.map((run) => run.entry), persisted: false };
    }
  }
}

async function clearLocalSimulationStore(cubeId: string): Promise<void> {
  await writeLocalSimulationStore(cubeId, []);
}

async function getStoragePressureNotice(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    if (!estimate.quota || estimate.usage === undefined) return null;
    const remaining = estimate.quota - estimate.usage;
    const remainingMb = remaining / 1024 / 1024;
    const usedRatio = estimate.usage / estimate.quota;
    if (remainingMb < 100 || usedRatio > 0.85) {
      return `Local browser storage is getting tight (${Math.max(0, Math.round(remainingMb))} MB estimated free). Old simulator runs may need to be cleared if saves start failing.`;
    }
  } catch {
    return null;
  }
  return null;
}

function nextLowerGpuBatchSize(batchSize: number): number | null {
  const lowerOptions = GPU_BATCH_OPTIONS.map((option) => parseInt(option.value, 10))
    .filter((value) => value < batchSize)
    .sort((a, b) => b - a);
  return lowerOptions[0] ?? null;
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
      text={`Delete the local simulation run from ${new Date(run.generatedAt).toLocaleString()}? This action cannot be undone.`}
      submitDelete={async () => {
        await onConfirm(run.ts);
        setOpen(false);
      }}
    />
  );
};

const ClearSimulationHistoryModal: React.FC<{
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}> = ({ isOpen, setOpen, onConfirm }) => (
  <ConfirmDeleteModal
    isOpen={isOpen}
    setOpen={setOpen}
    text="Clear all local simulation history for this cube? This only affects this browser and cannot be undone."
    submitDelete={async () => {
      await onConfirm();
      setOpen(false);
    }}
  />
);

const LeaveSimulationModal: React.FC<{
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  onLeave: () => void;
}> = ({ isOpen, setOpen, onLeave }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md offsetClassName="pt-12 md:pt-20">
      <ModalHeader setOpen={setOpen}>
        <Text semibold lg>
          Leave Simulator?
        </Text>
      </ModalHeader>
      <ModalBody>
        <Text>A simulation is still running. If you leave this page now, the current run will be interrupted.</Text>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" className="w-full justify-end" gap="2">
          <Button color="danger" onClick={onLeave}>
            Leave Page
          </Button>
          <Button color="secondary" onClick={() => setOpen(false)}>
            Stay Here
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

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

type DraftMapColorMode = 'cluster' | 'deckColor';

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

function computeFilteredCardStats(
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
              if (activePoolIndexSet.has(poolIndex)) {
                for (const oracle of pack) getStats(oracle).timesSeen++;
              }
              if (pack.length === 0) continue;
              if (step.action === 'trashrandom') {
                const trashed = runData.randomTrashByPool?.[poolIndex]?.[randomTrashPointers[poolIndex] ?? 0];
                randomTrashPointers[poolIndex] = (randomTrashPointers[poolIndex] ?? 0) + 1;
                if (!trashed)
                  return runData.cardStats.filter((c) => c.poolIndices.some((i) => activePoolIndexSet.has(i)));
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
        p1p1Seen: filtered.p1p1Seen,
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
  const variance = rates.length > 0 ? rates.reduce((sum, r) => sum + (r - mean) ** 2, 0) / rates.length : 0;
  const totalSeats = numDrafts * numSeats;
  const archetypeDistribution: ArchetypeEntry[] = [...archetypeCounts.entries()]
    .map(([colorPair, count]) => ({ colorPair, count, percentage: count / totalSeats }))
    .sort((a, b) => b.count - a.count);
  const deadCards = cardStats.filter((c) => c.pickRate < deadCardThreshold);

  const simulatedPools = reconstructSimulatedPools(slimPools, cardMeta);

  return {
    cubeId: setup.cubeId,
    cubeName,
    numDrafts,
    numSeats,
    deadCardThreshold,
    cardStats,
    deadCards,
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

const RowColorShare: React.FC<{ deck: BuiltDeck | null; cardMeta: Record<string, CardMeta> }> = ({ deck, cardMeta }) => {
  if (!deck || deck.mainboard.length === 0) return null;
  const shares: Record<string, number> = Object.fromEntries(COLOR_KEYS.map((k) => [k, 0]));
  for (const oracle of deck.mainboard) {
    const colors = getDeckShareColors(oracle, cardMeta);
    if (colors.length === 0) continue;
    const share = 1 / colors.length;
    for (const c of colors) shares[c] = (shares[c] ?? 0) + share;
  }
  const total = Object.values(shares).reduce((s, v) => s + v, 0);
  if (total === 0) return null;
  const segments = COLOR_KEYS.map((k) => ({ key: k, pct: (shares[k] ?? 0) / total, bg: MTG_COLORS[k]!.bg })).filter(
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

const DeckColorShareChart: React.FC<{ deckBuilds: BuiltDeck[] | null; cardMeta: Record<string, CardMeta> }> = ({
  deckBuilds,
  cardMeta,
}) => {
  if (!deckBuilds || deckBuilds.length === 0) {
    return (
      <Text sm className="text-text-secondary">
        Unavailable for this filter.
      </Text>
    );
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
    <div className="flex flex-row items-end gap-2 h-32">
      {rows.map((r) => (
        <div key={r.key} className="flex flex-col items-center gap-1 flex-1 min-w-0 h-full justify-end">
          <span className="text-[10px] text-text-secondary tabular-nums">{(r.pct * 100).toFixed(0)}%</span>
          <div className="w-full rounded" style={{ height: `${Math.max(4, r.pct * 100 * 0.95)}px`, background: r.bg }} />
          <span className="text-[10px] text-text-secondary truncate w-full text-center">{r.label}</span>
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

const ManaCurveShareChart: React.FC<{ deckBuilds: BuiltDeck[] | null; cardMeta: Record<string, CardMeta> }> = ({
  deckBuilds,
  cardMeta,
}) => {
  if (!deckBuilds || deckBuilds.length === 0) {
    return (
      <Text sm className="text-text-secondary">
        Unavailable for this filter.
      </Text>
    );
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
    <div className="flex flex-row items-end gap-1.5 h-32">
      {rows.map((row) => (
        <div key={row.key} className="flex flex-col items-center gap-1 flex-1 min-w-0 h-full justify-end">
          <span className="text-[10px] text-text-secondary tabular-nums">{(row.pct * 100).toFixed(0)}%</span>
          <div
            className="w-full rounded"
            style={{
              height: `${Math.max(4, row.pct * 100 * 0.95)}px`,
              background: 'linear-gradient(180deg, #475569 0%, #64748b 100%)',
            }}
          />
          <span className="text-[10px] text-text-secondary">{row.label}</span>
        </div>
      ))}
    </div>
  );
};

interface DraftMapPoint {
  x: number;
  y: number;
  poolIndex: number;
  draftIndex: number;
  seatIndex: number;
  clusterId: number | null;
  clusterIndex: number | null;
  clusterLabel: string;
  archetype: string;
}

function computeDraftMapPoints(
  slimPools: SlimPool[],
  displayedPools: SimulatedPool[],
  skeletons: ArchetypeSkeleton[],
  umapCoords: { x: number; y: number }[],
): DraftMapPoint[] {
  if (slimPools.length === 0 || umapCoords.length !== slimPools.length) return [];

  const clusterByPoolIndex = new Map<number, { clusterId: number; clusterIndex: number; label: string }>();
  skeletons.forEach((skeleton, index) => {
    for (const poolIndex of skeleton.poolIndices) {
      clusterByPoolIndex.set(poolIndex, {
        clusterId: skeleton.clusterId,
        clusterIndex: index,
        label: `Cluster ${index + 1}`,
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

const CLUSTER_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#ca8a04',
  '#9333ea',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#ea580c',
  '#4f46e5',
];

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value = parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Map an archetype string (e.g. "UB", "RG", "C") to a single hex colour.
 * For multi-colour archetypes we average the component MTG colours.
 */
function archetypeToColor(archetype: string): string {
  const codes = getColorProfileCodes(archetype);
  if (codes.length === 1) return MTG_COLORS[codes[0]!]?.bg ?? MTG_COLORS.C!.bg;
  // Average the RGB components
  let r = 0, g = 0, b = 0;
  for (const code of codes) {
    const hex = (MTG_COLORS[code]?.bg ?? MTG_COLORS.C!.bg).replace('#', '');
    r += parseInt(hex.substring(0, 2), 16);
    g += parseInt(hex.substring(2, 4), 16);
    b += parseInt(hex.substring(4, 6), 16);
  }
  r = Math.round(r / codes.length);
  g = Math.round(g / codes.length);
  b = Math.round(b / codes.length);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

const DraftMapScatter: React.FC<{
  points: DraftMapPoint[];
  selectedPoolIndex: number | null;
  activePoolIndexSet: Set<number> | null;
  colorMode: DraftMapColorMode;
  onSelectPoint: (point: DraftMapPoint) => void;
}> = ({ points, selectedPoolIndex, activePoolIndexSet, colorMode, onSelectPoint }) => {
  if (points.length === 0) {
    return (
      <Text sm className="text-text-secondary">
        Draft map is unavailable for this run.
      </Text>
    );
  }
  const hasActiveFilter = activePoolIndexSet !== null;
  const isInActiveFilter = (point: DraftMapPoint) => !hasActiveFilter || activePoolIndexSet.has(point.poolIndex);
  const pointBaseColor = (point: DraftMapPoint) => {
    if (colorMode === 'deckColor') return archetypeToColor(point.archetype);
    return point.clusterIndex === null ? MTG_COLORS.C!.bg : CLUSTER_COLORS[point.clusterIndex % CLUSTER_COLORS.length]!;
  };
  const selectedPoint = selectedPoolIndex === null ? null : (points.find((point) => point.poolIndex === selectedPoolIndex) ?? null);

  return (
    <Scatter
      data={{
        datasets: [
          {
            label: 'Draft decks',
            data: points,
            backgroundColor: points.map((point) => hexToRgba(pointBaseColor(point), isInActiveFilter(point) ? 0.9 : 0.15)),
            borderColor: 'transparent',
            borderWidth: 0,
            pointRadius: points.map((point) => (isInActiveFilter(point) ? 4 : 3)),
            pointHoverRadius: 7,
          },
          ...(selectedPoint
            ? [
                {
                  label: 'Focused deck',
                  data: [selectedPoint],
                  backgroundColor: '#facc15',
                  borderColor: '#111827',
                  borderWidth: 2,
                  pointRadius: 8,
                  pointHoverRadius: 9,
                },
              ]
            : []),
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,
        onClick: (_event, elements) => {
          const element = elements[0];
          if (!element) return;
          const point = element.datasetIndex === 1 ? selectedPoint : points[element.index];
          if (point) onSelectPoint(point);
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const point = ctx.raw as DraftMapPoint;
                return `${point.clusterLabel} · Draft ${point.draftIndex + 1} Seat ${point.seatIndex + 1} · ${point.archetype}`;
              },
            },
          },
        },
        scales: {
          x: { display: false },
          y: { display: false },
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
  const visibleEntries = archetypeDistribution.slice(0, 4);
  const hiddenEntries = archetypeDistribution.slice(4);
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
        <div className="rounded-full overflow-hidden" style={{ height: 10, background: 'rgb(var(--bg-accent) / 1)' }}>
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
            {showHiddenProfiles
              ? 'Show fewer color profiles'
              : `Show ${hiddenEntries.length} more color profile${hiddenEntries.length === 1 ? '' : 's'}`}
          </button>
        </>
      )}
    </div>
  );
};

type SortKey = keyof CardStats | 'deckInclusion' | 'openerTakeRate';
type DeckLocationFilter = 'all' | 'deck' | 'sideboard';
const CardStatsTable: React.FC<{
  cardStats: CardStats[];
  cardMeta?: Record<string, CardMeta>;
  deadCardThreshold: number;
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
  deadCardThreshold,
  onSelectCard,
  selectedCardOracles,
  inDeckOracles,
  inSideboardOracles,
  deckInclusionPct,
  visiblePoolCounts,
  onPageChange,
}) => {
  const PAGE_SIZE = 15;
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
              const isDead = c.pickRate < deadCardThreshold;
              const inclPct = deckInclusionPct.get(c.oracle_id);
              const isFilteredCard = selectedCardOracles.includes(c.oracle_id);
              const visiblePoolCount = visiblePoolCounts.get(c.oracle_id) ?? c.poolIndices.length;
              const openerTakeRate = c.p1p1Seen > 0 ? c.p1p1Count / c.p1p1Seen : 0;
              return (
                <tr
                  key={c.oracle_id}
                  className={[isFilteredCard ? 'bg-bg-active' : '', isDead ? 'bg-red-950/20' : 'hover:bg-bg-active']
                    .filter(Boolean)
                    .join(' ')}
                >
                  <td className="px-3 py-2 font-medium">{renderAutocardNameLink(c.oracle_id, c.name, cardMetaProp?.[c.oracle_id]?.imageUrl)}</td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">{Math.round(c.elo)}</td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">{c.timesSeen}</td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">{c.timesPicked}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={c.pickRate < deadCardThreshold ? 'text-red-400' : ''}>
                      {(c.pickRate * 100).toFixed(1)}%
                    </span>
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

const PickCard: React.FC<{ pick: SimulatedPickCard; isSelected: boolean }> = ({ pick, isSelected }) => (
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
);

type PoolViewMode = 'pool' | 'deck' | 'fullPickOrder';
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

function getPoolMainCards(pool: SimulatedPool, deck: BuiltDeck | null, cardMeta: Record<string, CardMeta>): string[] {
  if (deck?.mainboard?.length) return deck.mainboard;
  return pool.picks.map((pick) => pick.oracle_id).filter((oracleId) => !!cardMeta[oracleId]);
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

function inferDraftThemes(pool: SimulatedPool, deck: BuiltDeck | null, cardMeta: Record<string, CardMeta>): string[] {
  const cards = getPoolMainCards(pool, deck, cardMeta);
  let artifacts = 0;
  let enchantments = 0;
  let instantsSorceries = 0;
  let creatures = 0;
  const creatureTypeCounts = new Map<string, number>();

  for (const oracleId of cards) {
    const meta = cardMeta[oracleId];
    const type = meta?.type ?? '';
    const typeLower = type.toLowerCase();
    if (typeLower.includes('artifact')) artifacts++;
    if (typeLower.includes('enchantment')) enchantments++;
    if (typeLower.includes('instant') || typeLower.includes('sorcery')) instantsSorceries++;

    if (typeLower.includes('creature')) {
      creatures++;
      const subtypePart = type.split('—')[1] ?? type.split('-')[1] ?? '';
      for (const creatureType of subtypePart.trim().split(/\s+/).filter(Boolean)) {
        creatureTypeCounts.set(creatureType, (creatureTypeCounts.get(creatureType) ?? 0) + 1);
      }
    }
  }

  const topCreatureType = [...creatureTypeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const themes: string[] = [];
  if (artifacts >= 5) themes.push('Artifacts');
  if (instantsSorceries >= 8) themes.push('Spells');
  if (enchantments >= 5) themes.push('Enchantments');
  if (topCreatureType && topCreatureType[1] >= 4 && topCreatureType[1] / Math.max(1, creatures) >= 0.3) {
    themes.push(topCreatureType[0]);
  }
  if (creatures >= 16 && themes.length < 3) themes.push('Creatures');
  if (themes.length === 0) themes.push(archetypeFullName(pool.archetype));
  return themes.slice(0, 3);
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
): DraftBreakdownRowSummary {
  const composition = getDraftComposition(pool, deck, cardMeta);
  return {
    pool,
    deck,
    colors: pool.archetype,
    themes: inferDraftThemes(pool, deck, cardMeta),
    highlights: getDraftHighlights(pool, deck, cardMeta),
    ...composition,
  };
}

const ColorPips: React.FC<{ colors: string }> = ({ colors }) => (
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
);

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


type FilteredDraftCard = Pick<CardStats, 'oracle_id' | 'name'>;

function getFilteredCardPickLabels(pool: SimulatedPool, filteredCards: FilteredDraftCard[]) {
  return filteredCards.map((card) => {
    const pick = pool.picks.find((poolPick) => poolPick.oracle_id === card.oracle_id);
    return {
      oracle_id: card.oracle_id,
      name: card.name,
      label: pick ? `P${pick.packNumber + 1}P${pick.pickNumber}` : 'Not picked',
    };
  });
}

const FilteredCardPickChips: React.FC<{ picks: ReturnType<typeof getFilteredCardPickLabels> }> = ({ picks }) => (
  <div className="flex flex-wrap gap-1">
    {picks.map((pick) => (
      <span
        key={pick.oracle_id}
        className="rounded border border-link/20 bg-link/10 px-1.5 py-0.5 text-[11px] font-semibold text-link"
        title={`${pick.name}: ${pick.label}`}
      >
        <span className="font-medium">{pick.name}</span> {pick.label}
      </span>
    ))}
  </div>
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DraftBreakdownTable: React.FC<{
  pools: SimulatedPool[];
  deckBuilds: BuiltDeck[] | null;
  deckLoading: boolean;
  cardMeta: Record<string, CardMeta>;
  runData: SimulationRunData;
  viewMode: PoolViewMode;
  setViewMode: (mode: PoolViewMode) => void;
  highlightOracle?: string;
  showLocationFilter?: boolean;
  selectedCardName?: string;
  filteredCards?: FilteredDraftCard[];
  focusedPoolIndex?: number | null;
}> = ({
  pools,
  deckBuilds,
  deckLoading,
  cardMeta,
  runData,
  viewMode,
  setViewMode,
  highlightOracle,
  showLocationFilter = false,
  selectedCardName,
  filteredCards = [],
  focusedPoolIndex = null,
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

  const summaries = useMemo(
    () => pools.map((pool) => buildDraftBreakdownRowSummary(pool, deckBuilds?.[pool.poolIndex] ?? null, cardMeta)),
    [pools, deckBuilds, cardMeta],
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
      if (!themes.some((t) => t.includes(q))) return false;
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
              onClick={() => setSelectedPool(summary.pool.poolIndex)}
            >
              <Flexbox direction="row" justify="between" alignItems="center" className="gap-2">
                <div>
                  <Text sm semibold className="block">
                    Draft {summary.pool.draftIndex + 1} · Seat {summary.pool.seatIndex + 1}
                  </Text>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {summary.themes.map((theme) => (
                      <span key={theme} className="rounded bg-bg-accent px-1.5 py-0.5 text-[11px] text-text-secondary">
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <ColorPips colors={summary.colors} />
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
              {filteredCards.length > 0 && (
                <div className="mt-2">
                  <FilteredCardPickChips picks={getFilteredCardPickLabels(summary.pool, filteredCards)} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-b border border-t-0 border-border bg-bg md:block">
        <table className="min-w-full text-base" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 150 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 240 }} />
            {filteredCards.length > 0 && <col />}
            <col style={{ width: 200 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 180 }} />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-border bg-bg-accent">
              {renderSortHeader('Draft · Seat', 'draft')}
              {renderSortHeader('Colors', 'color')}
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">
                Theme
              </th>
              {filteredCards.length > 0 && (
                <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">
                  Picked
                </th>
              )}
              {renderSortHeader('Composition', 'creatures')}
              {renderSortHeader('Curve', 'avgMv')}
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">
                Color share
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
                  onClick={() => setSelectedPool(summary.pool.poolIndex)}
                >
                  <td className="px-3 py-4 tabular-nums">
                    <span className={isSelected ? 'font-bold text-text' : 'font-semibold text-text'}>
                      D{summary.pool.draftIndex + 1}
                    </span>
                    <span className="text-text-secondary"> · S{summary.pool.seatIndex + 1}</span>
                  </td>
                  <td className="px-3 py-4">
                    <ColorPips colors={summary.colors} />
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex flex-wrap gap-0.5">
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
                  {filteredCards.length > 0 && (
                    <td className="px-3 py-4">
                      <FilteredCardPickChips picks={getFilteredCardPickLabels(summary.pool, filteredCards)} />
                    </td>
                  )}
                  <td className="px-3 py-4 whitespace-nowrap tabular-nums text-sm">
                    <span className="font-semibold text-text">{summary.creatureCount}</span>
                    <span className="text-text-secondary/60">C</span>
                    <span className="text-text-secondary/40"> · </span>
                    <span className="font-semibold text-text">{summary.nonCreatureCount}</span>
                    <span className="text-text-secondary/60">NC</span>
                    {summary.landCount > 0 && (
                      <>
                        <span className="text-text-secondary/40"> · </span>
                        <span className="font-semibold text-text">{summary.landCount}</span>
                        <span className="text-text-secondary/60">L</span>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <TinyCurve
                      creatureCounts={summary.creatureCurveCounts}
                      nonCreatureCounts={summary.nonCreatureCurveCounts}
                    />
                  </td>
                  <td className="px-3 py-4">
                    <RowColorShare deck={summary.deck} cardMeta={cardMeta} />
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
              <Text xs className="block text-text-secondary">
                {selectedSummary.themes.join(', ')}
                {selectedCardName ? ` · ${selectedCardName}` : ''}
              </Text>
            </div>
            <ViewToggle
              mode={viewMode}
              onChange={setViewMode}
              hasDeck={hasDeck}
              hasFullPickOrder={hasFullPickOrder}
              deckLoading={deckLoading}
            />
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

const DraftVsEloTable: React.FC<{ cardStats: CardStats[] }> = ({ cardStats }) => {
  const [isOpen, setIsOpen] = useState(true);
  const picked = cardStats.filter((c) => c.timesPicked > 0 && c.avgPickPosition > 0);
  const eloRankMap = new Map([...picked].sort((a, b) => b.elo - a.elo).map((c, i) => [c.oracle_id, i + 1]));
  const draftRankMap = new Map(
    [...picked].sort((a, b) => a.avgPickPosition - b.avgPickPosition).map((c, i) => [c.oracle_id, i + 1]),
  );
  const rows = picked.map((c) => {
    const eloRank = eloRankMap.get(c.oracle_id) ?? 0;
    const draftRank = draftRankMap.get(c.oracle_id) ?? 0;
    return {
      oracle_id: c.oracle_id,
      name: c.name,
      elo: Math.round(c.elo),
      eloRank,
      draftRank,
      delta: eloRank - draftRank,
      avgPickPosition: c.avgPickPosition,
      pickRate: c.pickRate,
    };
  });
  const gainers = [...rows].sort((a, b) => b.delta - a.delta).slice(0, 20);
  const losers = [...rows].sort((a, b) => a.delta - b.delta).slice(0, 20);
  const cols = ['Card', 'Elo', 'Elo Rank', 'Draft Rank', 'Delta', 'Avg Position', 'Pick Rate'];
  const TH = () => (
    <thead className="bg-bg-accent">
      <tr>
        {cols.map((h, idx) => (
          <th
            key={h}
            className={[
              'px-3 py-2 text-xs font-medium uppercase tracking-wider',
              idx === 0 ? 'text-left' : 'text-right',
            ].join(' ')}
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
  const DR: React.FC<{ row: (typeof rows)[0] }> = ({ row }) => (
    <tr className="hover:bg-bg-active">
      <td className="px-3 py-2 font-medium">{renderAutocardNameLink(row.oracle_id, row.name)}</td>
      <td className="px-3 py-2 text-text-secondary text-right tabular-nums">{row.elo}</td>
      <td className="px-3 py-2 text-text-secondary text-right tabular-nums">#{row.eloRank}</td>
      <td className="px-3 py-2 text-text-secondary text-right tabular-nums">#{row.draftRank}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        <span
          className={row.delta > 0 ? 'text-green-400 font-medium' : row.delta < 0 ? 'text-red-400 font-medium' : ''}
        >
          {row.delta > 0 ? `+${row.delta}` : row.delta}
        </span>
      </td>
      <td className="px-3 py-2 text-text-secondary text-right tabular-nums">{row.avgPickPosition.toFixed(1)}</td>
      <td className="px-3 py-2 text-text-secondary text-right tabular-nums">{(row.pickRate * 100).toFixed(1)}%</td>
    </tr>
  );
  return (
    <Card>
      <CardHeader>
        <Flexbox direction="row" justify="between" alignItems="center" className="flex-wrap gap-2">
          <button type="button" className="flex-1 text-left" onClick={() => setIsOpen((open) => !open)}>
            <Text semibold>Overperformers / Underperformers</Text>
            <div className="mt-0.5">
              <Text xs className="text-text-secondary">
                Cards drafted earlier or later than Elo would suggest
              </Text>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            className="whitespace-nowrap px-2 py-1 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active"
          >
            {isOpen ? '▲ Hide' : '▼ Show'}
          </button>
        </Flexbox>
      </CardHeader>
      <Collapse isOpen={isOpen}>
        <CardBody>
          <Row className="gap-4">
            {[
              { title: 'Overperformers', data: gainers },
              { title: 'Underperformers', data: losers },
            ].map(({ title, data }) => (
              <Col key={title} xs={12} md={6}>
                <div className="h-full rounded border border-border bg-bg">
                  <div className="border-b border-border bg-bg-accent/50 px-3 py-2">
                    <Text semibold>{title}</Text>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border text-sm">
                      <TH />
                      <tbody className="divide-y divide-border">
                        {data.map((row) => (
                          <DR key={row.oracle_id} row={row} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </CardBody>
      </Collapse>
    </Card>
  );
};

const SkeletonCardImage: React.FC<{ card: SkeletonCard; size?: number }> = ({ card, size }) => (
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
);

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

/** Panel shown to the right of the Draft Map when a cluster is selected. */
const ClusterDetailPanel: React.FC<{
  skeleton: ArchetypeSkeleton;
  clusterIndex: number;
  totalPools: number;
  clusterDeckBuilds: BuiltDeck[] | null;
  cardMeta: Record<string, CardMeta>;
  commonCards?: SkeletonCard[];
  onClose: () => void;
}> = ({ skeleton, clusterIndex, totalPools, clusterDeckBuilds, cardMeta, commonCards = [], onClose }) => {
  // Compute actual color profile from deck color shares (≥10% threshold)
  const colorProfile = useMemo(() => {
    if (!clusterDeckBuilds || clusterDeckBuilds.length === 0) return skeleton.colorProfile;
    const shares: Record<string, number> = Object.fromEntries(COLOR_KEYS.map((k) => [k, 0]));
    for (const deck of clusterDeckBuilds) {
      for (const oracle of deck.mainboard) {
        const colors = getDeckShareColors(oracle, cardMeta);
        if (colors.length === 0) continue;
        const share = 1 / colors.length;
        for (const c of colors) shares[c] = (shares[c] ?? 0) + share;
      }
    }
    const total = Object.values(shares).reduce((s, v) => s + v, 0);
    if (total === 0) return 'C';
    const significant = COLOR_KEYS.filter((k) => (shares[k] ?? 0) / total >= 0.1);
    return significant.length > 0 ? significant.join('') : 'C';
  }, [clusterDeckBuilds, cardMeta, skeleton.colorProfile]);

  const colorCodes = getColorProfileCodes(colorProfile);
  const pct = totalPools > 0 ? ((skeleton.poolCount / totalPools) * 100).toFixed(1) : '0';
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Text semibold className="text-base">Cluster {clusterIndex + 1}</Text>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="flex items-center gap-0.5">
              {colorCodes.map((code) => (
                <span
                  key={code}
                  className="inline-block w-3 h-3 rounded-full border border-border/50"
                  style={{ background: MTG_COLORS[code]?.bg ?? MTG_COLORS.C!.bg }}
                />
              ))}
            </div>
            <Text xs className="text-text-secondary">
              {archetypeFullName(colorProfile)} · {skeleton.poolCount} seats · {pct}%
            </Text>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active flex-shrink-0"
        >
          ✕
        </button>
      </div>
      {commonCards.length > 0 ? (
        <div>
          <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Most common in filter</Text>
          <div className="grid grid-cols-6 gap-1.5">
            {commonCards.slice(0, 12).map((card) => (
              <SkeletonCardImage key={card.oracle_id} card={card} />
            ))}
          </div>
        </div>
      ) : skeleton.coreCards.length > 0 && (
        <div>
          <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Defining cards</Text>
          <div className="grid grid-cols-6 gap-1.5">
            {skeleton.coreCards.slice(0, 12).map((card) => (
              <SkeletonCardImage key={card.oracle_id} card={card} />
            ))}
          </div>
        </div>
      )}
      <div>
        <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Deck Color Share</Text>
        <DeckColorShareChart deckBuilds={clusterDeckBuilds} cardMeta={cardMeta} />
      </div>
      <div>
        <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Mana Curve Share</Text>
        <ManaCurveShareChart deckBuilds={clusterDeckBuilds} cardMeta={cardMeta} />
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
}> = ({ title, subtitle, commonCards, deckBuilds, cardMeta }) => (
  <div className="flex flex-col gap-3">
    <div>
      <Text semibold className="text-base">
        {title}
      </Text>
      <Text xs className="text-text-secondary">
        {subtitle}
      </Text>
    </div>
    {commonCards.length > 0 && (
      <div>
        <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Most common in filter</Text>
        <div className="grid grid-cols-6 gap-1.5">
          {commonCards.slice(0, 12).map((card) => (
            <SkeletonCardImage key={card.oracle_id} card={card} />
          ))}
        </div>
      </div>
    )}
    <div>
      <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Deck Color Share</Text>
      <DeckColorShareChart deckBuilds={deckBuilds} cardMeta={cardMeta} />
    </div>
    <div>
      <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Mana Curve Share</Text>
      <ManaCurveShareChart deckBuilds={deckBuilds} cardMeta={cardMeta} />
    </div>
  </div>
);

const ArchetypeSkeletonSection: React.FC<{
  skeletons: ArchetypeSkeleton[];
  totalPools: number;
  selectedSkeletonId: number | null;
  onSelectSkeleton: (id: number | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ skeletons, totalPools, selectedSkeletonId, onSelectSkeleton, isOpen, onToggle }) => (
  <ArchetypeSkeletonSectionInner
    skeletons={skeletons}
    totalPools={totalPools}
    selectedSkeletonId={selectedSkeletonId}
    onSelectSkeleton={onSelectSkeleton}
    isOpen={isOpen}
    onToggle={onToggle}
  />
);

const ArchetypeSkeletonSectionInner: React.FC<{
  skeletons: ArchetypeSkeleton[];
  totalPools: number;
  selectedSkeletonId: number | null;
  onSelectSkeleton: (id: number | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ skeletons, totalPools, selectedSkeletonId, onSelectSkeleton, isOpen, onToggle }) => {
  const [showAllClusters, setShowAllClusters] = useState(false);
  const visibleSkeletons = skeletons.slice(0, 4);
  const hiddenSkeletons = skeletons.slice(4);
  const hiddenHasSelection = hiddenSkeletons.some((skeleton) => skeleton.clusterId === selectedSkeletonId);
  const showHiddenClusters = showAllClusters || hiddenHasSelection;

  const renderSkeleton = (skeleton: ArchetypeSkeleton, skIdx: number) => (
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
          <span className="font-semibold tracking-tight">Cluster {skIdx + 1}</span>
          <span className="text-xs text-text-secondary">
            {skeleton.poolCount} seats · {((skeleton.poolCount / totalPools) * 100).toFixed(1)}%
          </span>
          <span>
            {selectedSkeletonId === skeleton.clusterId && (
              <span className="inline-flex w-fit text-xs bg-link/20 text-link border border-link/30 rounded px-2 py-0.5">
                Filtering
              </span>
            )}
          </span>
        </div>
      </button>
      {skeleton.coreCards.length > 0 ? (
        <div className="min-w-0 flex flex-row gap-1 overflow-x-auto pb-1 md:pb-0">
          {skeleton.coreCards.map((card) => (
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

  return (
    <Card>
      <CardHeader>
        <Flexbox direction="row" justify="between" alignItems="center" className="flex-wrap gap-2">
          <button type="button" className="flex-1 text-left" onClick={onToggle}>
            <Flexbox direction="row" gap="2" alignItems="center">
              <Text semibold>Archetypes</Text>
              {!isOpen && <span className="text-xs text-text-secondary font-normal">{skeletons.length} clusters</span>}
            </Flexbox>
            <Text xs className="text-text-secondary mt-0.5">
              Grouped by shared cards
            </Text>
          </button>
          <div className="flex flex-row items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onToggle}
              className="whitespace-nowrap px-2 py-1 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active"
            >
              {isOpen ? '▲ Hide' : '▼ Show'}
            </button>
          </div>
        </Flexbox>
      </CardHeader>
      <Collapse isOpen={isOpen}>
        <CardBody>
          <Flexbox direction="col" gap="3">
            <div className="overflow-hidden rounded-lg border border-border/80 divide-y divide-border/70">
              {visibleSkeletons.map((skeleton, idx) => renderSkeleton(skeleton, idx))}
              {showHiddenClusters && hiddenSkeletons.map((skeleton, idx) => renderSkeleton(skeleton, idx + 3))}
            </div>
            {hiddenSkeletons.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAllClusters((open) => !open)}
                className="self-start px-2 py-1 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active"
              >
                {showHiddenClusters
                  ? 'Show fewer clusters'
                  : `Show ${hiddenSkeletons.length} more cluster${hiddenSkeletons.length === 1 ? '' : 's'}`}
              </button>
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

interface CubeDraftSimulatorPageProps {
  cube: Cube;
}

const CubeDraftSimulatorPage: React.FC<CubeDraftSimulatorPageProps> = ({ cube }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const cubeId = getCubeId(cube);

  // Controls
  const [numDrafts, setNumDrafts] = useState(100);
  const [numSeats, setNumSeats] = useState(8);
  const [deadCardThresholdPct, setDeadCardThresholdPct] = useState(5);
  const [gpuBatchSize, setGpuBatchSize] = useState(32);
  const [selectedFormatId, setSelectedFormatId] = useState(cube.defaultFormat ?? -1);

  // Simulation state
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [simPhase, setSimPhase] = useState<'setup' | 'loadmodel' | 'sim' | 'deckbuild' | 'save' | null>(null);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [simProgress, setSimProgress] = useState(0); // 0–100
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Run history & display
  const [runs, setRuns] = useState<SimulationRunEntry[]>([]);
  const [displayRunData, setDisplayRunData] = useState<SimulationRunData | null>(null);
  const [currentRunSetup, setCurrentRunSetup] = useState<Pick<
    SimulationSetupResponse,
    'initialPacks' | 'packSteps' | 'numSeats'
  > | null>(null);
  const [selectedTs, setSelectedTs] = useState<number | null>(null);
  const [loadingRun, setLoadingRun] = useState(false);
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
  const simAbortRef = useRef<AbortController | null>(null);

  // Section collapse state (default open)
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [detailedViewOpen, setDetailedViewOpen] = useState(true);
  const [draftBreakdownOpen, setDraftBreakdownOpen] = useState(true);
  const [referenceOpen, setReferenceOpen] = useState(true);
  const [archetypesOpen, setArchetypesOpen] = useState(true);
  const [deckColorOpen, setDeckColorOpen] = useState(true);
  const [cardStatsOpen, setCardStatsOpen] = useState(true);
  const [draftMapColorMode, setDraftMapColorMode] = useState<DraftMapColorMode>('cluster');

  // Archetype skeleton clustering
  const [minClusterSize, setMinClusterSize] = useState(3);
  const [pendingMinClusterSize, setPendingMinClusterSize] = useState(3);
  const [clusterSeed, setClusterSeed] = useState(0);

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

  const [historyLoadError, setHistoryLoadError] = useState<string | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);
  const isRunning = status === 'running';
  const overallSimProgress = useMemo(
    () => getOverallSimProgress(simPhase, modelLoadProgress, simProgress),
    [simPhase, modelLoadProgress, simProgress],
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

  // Load per-cube local history on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const store = await readLocalSimulationStore(cubeId);
        if (cancelled) return;
        const nextRuns = store.runs.map((run) => run.entry);
        setRuns(nextRuns);
        if (store.runs[0]) {
          setDisplayRunData(store.runs[0].runData);
          setCurrentRunSetup(store.runs[0].runData.setupData ?? null);
          setSelectedTs(store.runs[0].entry.ts);
        } else {
          setDisplayRunData(null);
          setCurrentRunSetup(null);
          setSelectedTs(null);
        }
        setHistoryLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setHistoryLoadError(err instanceof Error ? err.message : 'Failed to load local simulation history');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cubeId]);

  useEffect(() => {
    if (!isRunning) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = anchor.href;
      if (!href) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      const nextUrl = new URL(href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;
      if (nextUrl.href === window.location.href) return;
      event.preventDefault();
      setPendingNavigationHref(nextUrl.href);
      setLeaveModalOpen(true);
    };
    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [isRunning]);

  const [loadRunError, setLoadRunError] = useState<string | null>(null);
  const loadRunInFlight = useRef(false);

  const handleLoadRun = useCallback(
    async (ts: number) => {
      if (ts === selectedTs && displayRunData) return;
      if (loadRunInFlight.current) return;
      loadRunInFlight.current = true;
      setLoadingRun(true);
      setLoadRunError(null);
      setSelectedCardOracles([]);
      setSelectedArchetype(null);
      setSelectedSkeletonId(null);
      setFocusedPoolIndex(null);
      try {
        const store = await readLocalSimulationStore(cubeId);
        const run = store.runs.find((entry) => entry.entry.ts === ts);
        if (!run) {
          setLoadRunError('Run not found in local storage');
        } else {
          setDisplayRunData(run.runData);
          setCurrentRunSetup(run.runData.setupData ?? null);
          setSelectedTs(ts);
        }
      } catch (err) {
        setLoadRunError(err instanceof Error ? err.message : 'Failed to load run');
      } finally {
        setLoadingRun(false);
        loadRunInFlight.current = false;
      }
    },
    [cubeId, selectedTs, displayRunData],
  );

  const handleDeleteRun = useCallback(
    async (ts: number) => {
      try {
        const store = await readLocalSimulationStore(cubeId);
        const nextStoredRuns = store.runs.filter((run) => run.entry.ts !== ts);
        await writeLocalSimulationStore(cubeId, nextStoredRuns);
        const nextRuns = nextStoredRuns.map((run) => run.entry);
        setRuns(nextRuns);
        setSelectedCardOracles([]);
        setSelectedArchetype(null);
        setSelectedSkeletonId(null);
        setFocusedPoolIndex(null);

        if (selectedTs === ts) {
          setDisplayRunData(nextStoredRuns[0]?.runData ?? null);
          setCurrentRunSetup(nextStoredRuns[0]?.runData.setupData ?? null);
          setSelectedTs(nextRuns[0]?.ts ?? null);
        }
      } catch (err) {
        console.error('Failed to delete run:', err);
      }
    },
    [cubeId, selectedTs],
  );

  const handleClearHistory = useCallback(async () => {
    await clearLocalSimulationStore(cubeId);
    setRuns([]);
    setDisplayRunData(null);
    setCurrentRunSetup(null);
    setSelectedTs(null);
    setSelectedCardOracles([]);
    setSelectedArchetype(null);
    setSelectedSkeletonId(null);
    setFocusedPoolIndex(null);
    setStorageNotice(null);
  }, [cubeId]);

  const handleCancel = useCallback(() => {
    simAbortRef.current?.abort();
    simAbortRef.current = null;
    setStatus('idle');
    setSimPhase(null);
    setSimProgress(0);
    setErrorMsg(null);
  }, []);

  const handleConfirmedLeave = useCallback(() => {
    if (!pendingNavigationHref) {
      setLeaveModalOpen(false);
      return;
    }
    simAbortRef.current?.abort();
    window.location.assign(pendingNavigationHref);
  }, [pendingNavigationHref]);

  const handleStart = useCallback(async () => {
    const controller = new AbortController();
    const runStart = performance.now();
    let setupMs = 0;
    let modelLoadMs = 0;
    let simulationMs = 0;
    let deckbuildMs = 0;
    let saveMs = 0;
    simAbortRef.current = controller;
    setStatus('running');
    setSimPhase('setup');
    setSimProgress(0);
    setErrorMsg(null);
    setStorageNotice(null);
    setSelectedCardOracles([]);
    setSelectedArchetype(null);
    setSelectedSkeletonId(null);
    setFocusedPoolIndex(null);
    try {
      const setupTimeout = new AbortController();
      const setupTimeoutId = setTimeout(() => setupTimeout.abort(), 120_000);
      // Merge user cancel + setup timeout into a single signal
      const setupSignal = AbortSignal.any
        ? AbortSignal.any([controller.signal, setupTimeout.signal])
        : setupTimeout.signal;
      let setupRes: Response;
      try {
        const setupStart = performance.now();
        setupRes = await csrfFetch(`/cube/api/simulatesetup/${encodeURIComponent(cubeId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ numDrafts, numSeats, formatId: selectedFormatId }),
          signal: setupSignal,
        });
        setupMs = performance.now() - setupStart;
      } catch (fetchErr) {
        clearTimeout(setupTimeoutId);
        if (setupTimeout.signal.aborted) {
          setStatus('failed');
          setSimPhase(null);
          setErrorMsg(
            `Setup timed out after 120 s — the server took too long to generate ${numDrafts} drafts. Try a smaller number.`,
          );
          return;
        }
        throw fetchErr; // user cancel or network error — let outer catch handle it
      }
      clearTimeout(setupTimeoutId);
      const setupData = await setupRes.json();
      if (!setupData.success) {
        setStatus('failed');
        setSimPhase(null);
        setErrorMsg(setupData.message ?? 'Failed to set up simulation');
        return;
      }

      // Load the TF.js draft model locally (no-op if already loaded from a previous run)
      setSimPhase('loadmodel');
      setModelLoadProgress(0);
      const modelLoadStart = performance.now();
      await loadDraftBot((pct) => setModelLoadProgress(pct));
      modelLoadMs = performance.now() - modelLoadStart;

      let effectiveGpuBatchSize = gpuBatchSize;
      const retryNotices: string[] = [];
      setSimPhase('sim');
      const simulationStart = performance.now();
      let report: SimulationReport;
      try {
        report = await runClientSimulation(
          setupData as SimulationSetupResponse,
          numDrafts,
          deadCardThresholdPct / 100,
          setSimProgress,
          controller.signal,
          effectiveGpuBatchSize,
        );
      } catch (err) {
        const fallbackBatchSize =
          err instanceof WebGLInferenceError ? nextLowerGpuBatchSize(effectiveGpuBatchSize) : null;
        if (!fallbackBatchSize) throw err;
        retryNotices.push(
          `Draft simulation exceeded GPU memory at batch size ${effectiveGpuBatchSize}; retried at ${fallbackBatchSize}.`,
        );
        effectiveGpuBatchSize = fallbackBatchSize;
        setSimProgress(0);
        report = await runClientSimulation(
          setupData as SimulationSetupResponse,
          numDrafts,
          deadCardThresholdPct / 100,
          setSimProgress,
          controller.signal,
          effectiveGpuBatchSize,
        );
      }
      simulationMs = performance.now() - simulationStart;
      setCurrentRunSetup(setupData as SimulationSetupResponse);

      // Build decks for all pools before saving
      setSimPhase('deckbuild');
      const deckbuildStart = performance.now();
      let deckResult: { decks: BuiltDeck[]; basicCardMeta: Record<string, CardMeta> } | null;
      try {
        deckResult = await buildAllDecks(
          report.slimPools,
          setupData as SimulationSetupResponse,
          controller.signal,
          effectiveGpuBatchSize,
        );
      } catch (err) {
        const fallbackBatchSize =
          err instanceof WebGLInferenceError ? nextLowerGpuBatchSize(effectiveGpuBatchSize) : null;
        if (!fallbackBatchSize) throw err;
        retryNotices.push(
          `Deckbuilding exceeded GPU memory at batch size ${effectiveGpuBatchSize}; retried at ${fallbackBatchSize}.`,
        );
        effectiveGpuBatchSize = fallbackBatchSize;
        deckResult = await buildAllDecks(
          report.slimPools,
          setupData as SimulationSetupResponse,
          controller.signal,
          effectiveGpuBatchSize,
        );
      }
      deckbuildMs = performance.now() - deckbuildStart;
      if (!deckResult) {
        setStatus('failed');
        setSimPhase(null);
        setErrorMsg('Deck building failed. The simulation ran successfully but decks could not be built.');
        return;
      }

      // Assemble the locally persisted run payload; merge basic land metadata into cardMeta.
      setSimPhase('save');
      const saveStart = performance.now();
      const { simulatedPools: _derived, ...runDataBase } = report;
      const mergedCardMeta = { ...runDataBase.cardMeta, ...deckResult.basicCardMeta };
      const timings: SimulationTimingBreakdown = {
        setupMs,
        modelLoadMs,
        simulationMs,
        deckbuildMs,
        saveMs: 0,
        totalMs: 0,
      };
      const runData = {
        ...runDataBase,
        cardMeta: mergedCardMeta,
        deckBuilds: deckResult.decks,
        setupData: report.setupData,
        timings,
      };
      const ts = Date.now();
      const entry: SimulationRunEntry = {
        ts,
        generatedAt: runData.generatedAt,
        numDrafts: runData.numDrafts,
        numSeats: runData.numSeats,
        deadCardCount: runData.deadCards.length,
        convergenceScore: runData.convergenceScore ?? 0,
      };
      runData.timings = {
        setupMs,
        modelLoadMs,
        simulationMs,
        deckbuildMs,
        saveMs: 0,
        totalMs: performance.now() - runStart,
      };
      const storagePressureNotice = await getStoragePressureNotice();
      const persistResult = await persistSimulationRun(cubeId, entry, runData);
      saveMs = performance.now() - saveStart;
      runData.timings = {
        setupMs,
        modelLoadMs,
        simulationMs,
        deckbuildMs,
        saveMs,
        totalMs: performance.now() - runStart,
      };
      setRuns(persistResult.runs);
      if (!persistResult.persisted) {
        setStorageNotice('Results are shown below, but this browser did not have enough local storage to save them.');
      } else if (retryNotices.length > 0 || storagePressureNotice) {
        setStorageNotice([...retryNotices, storagePressureNotice].filter(Boolean).join(' '));
      }

      setStatus('completed');
      setSimPhase(null);
      setDisplayRunData(runData);
      setSelectedTs(ts);
      simAbortRef.current = null;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return; // user cancelled — state already reset by handleCancel
      setStatus('failed');
      setSimPhase(null);
      if (err instanceof WebGLInferenceError) {
        const draftSuggestion =
          numDrafts > 1 ? `reduce the draft count (currently ${numDrafts})` : 'run fewer seats or a smaller format';
        const batchSuggestion = gpuBatchSize > 16 ? ' or lower the GPU batch size' : '';
        setErrorMsg(
          `Your GPU ran out of memory during simulation. Try to ${draftSuggestion}${batchSuggestion}, then run it again.`,
        );
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Simulation failed');
      }
    }
  }, [csrfFetch, cubeId, numDrafts, numSeats, deadCardThresholdPct, gpuBatchSize, buildAllDecks, selectedFormatId]);

  const lastRunTs = runs[0]?.ts ?? null;

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
  const [skeletons, setSkeletons] = useState<ArchetypeSkeleton[]>([]);
  const [umapCoords, setUmapCoords] = useState<{ x: number; y: number }[]>([]);
  const [clusteringInProgress, setClusteringInProgress] = useState(false);
  const [poolEmbeddings, setPoolEmbeddings] = useState<number[][] | null>(null);

  // Compute 128-dim embeddings for each pool/deck via the ML encoder
  useEffect(() => {
    if (!displayRunData || displayRunData.slimPools.length === 0) {
      setPoolEmbeddings(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await loadDraftBot();
        const remapping = buildOracleRemapping(displayRunData.cardMeta);
        const hasDecks = activeDecks && activeDecks.length === displayRunData.slimPools.length;
        const pools = displayRunData.slimPools.map((pool, i) => {
          const cards = hasDecks ? activeDecks![i]!.mainboard : pool.picks.map((p) => p.oracle_id);
          return cards;
        });
        const flat = await encodePools(pools, remapping);
        if (!cancelled) {
          setPoolEmbeddings(reshapeEmbeddings(flat, pools.length));
        }
      } catch {
        // If encoding fails (e.g. model not loaded), fall back to null embeddings
        if (!cancelled) setPoolEmbeddings(null);
      }
    })();
    return () => { cancelled = true; };
  }, [displayRunData, activeDecks]);

  // Clustering: embeddings → UMAP → HDBSCAN
  useEffect(() => {
    if (!displayRunData || displayRunData.slimPools.length === 0) {
      setSkeletons([]);
      setUmapCoords([]);
      setClusteringInProgress(false);
      return;
    }
    setClusteringInProgress(true);
    // setTimeout lets the loading state paint before the synchronous compute blocks
    const timer = setTimeout(() => {
      const result = computeSkeletons(displayRunData.slimPools, displayRunData.cardMeta, minClusterSize, poolEmbeddings, activeDecks);
      setSkeletons(result.skeletons);
      setUmapCoords(result.umapCoords);
      setClusteringInProgress(false);
    }, 20);
    return () => clearTimeout(timer);
    // clusterSeed intentionally triggers re-cluster without being a real dependency
  }, [displayRunData, minClusterSize, clusterSeed, activeDecks, poolEmbeddings]);
  const draftMapPoints = useMemo(
    () =>
      displayRunData
        ? computeDraftMapPoints(displayRunData.slimPools, displayedPools, skeletons, umapCoords)
        : [],
    [displayRunData, displayedPools, skeletons, umapCoords],
  );

  const selectedCards = useMemo(
    () =>
      displayRunData
        ? selectedCardOracles
            .map((oracle) => displayRunData.cardStats.find((c) => c.oracle_id === oracle) ?? null)
            .filter((c): c is CardStats => !!c)
        : [],
    [displayRunData, selectedCardOracles],
  );
  const selectedCard = selectedCards.length === 1 ? (selectedCards[0] ?? null) : null;
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

    for (const selectedCardEntry of selectedCards) {
      filterSets.push(new Set<number>(selectedCardEntry.poolIndices));
    }

    if (filterSets.length === 0) return null;

    const [first, ...rest] = filterSets;
    const intersection = new Set<number>(first);
    for (const value of [...intersection]) {
      if (!rest.every((set) => set.has(value))) intersection.delete(value);
    }
    return intersection;
  }, [selectedArchetype, selectedSkeletonId, selectedCards, skeletons, displayedPools]);

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
    () => (selectedCard ? (visibleCardStats.find((c) => c.oracle_id === selectedCard.oracle_id) ?? null) : null),
    [visibleCardStats, selectedCard],
  );
  const visiblePoolCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cardStat of visibleCardStats) counts.set(cardStat.oracle_id, cardStat.poolIndices.length);
    return counts;
  }, [visibleCardStats]);
  const hasApproximateFilteredStats = !!(activeFilterPoolIndexSet && !currentRunSetup);

  const selectedPools =
    selectedCards.length > 0
      ? displayedPools.filter((p) => !activeFilterPoolIndexSet || activeFilterPoolIndexSet.has(p.poolIndex))
      : [];
  const focusedPool =
    focusedPoolIndex === null ? null : (displayedPools.find((pool) => pool.poolIndex === focusedPoolIndex) ?? null);
  const focusedDeck = focusedPool ? (activeDecks?.[focusedPool.poolIndex] ?? null) : null;
  const focusedDeckAvailable = !!focusedDeck && (focusedDeck.mainboard.length > 0 || focusedDeck.sideboard.length > 0);
  const focusedFullPickOrderAvailable = !!displayRunData?.setupData;
  const effectiveFocusedPoolViewMode =
    (focusedPoolViewMode === 'deck' && !focusedDeckAvailable) ||
    (focusedPoolViewMode === 'fullPickOrder' && !focusedFullPickOrderAvailable)
      ? 'pool'
      : focusedPoolViewMode;
  const scopedPools = useMemo(
    () => displayedPools.filter((p) => !activeFilterPoolIndexSet || activeFilterPoolIndexSet.has(p.poolIndex)),
    [displayedPools, activeFilterPoolIndexSet],
  );

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (selectedSkeletonId !== null) {
      const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
      const skIdx = skeletons.indexOf(sk!);
      if (sk) chips.push(`Cluster: ${skIdx + 1}`);
    }
    if (selectedArchetype) chips.push(`Deck Color: ${archetypeFullName(selectedArchetype)}`);
    for (const selectedCardEntry of selectedCards) chips.push(`Pools Containing: ${selectedCardEntry.name}`);
    return chips;
  }, [selectedSkeletonId, selectedArchetype, selectedCards, skeletons]);

  const activeFilterSummary = useMemo(() => {
    if (activeFilterChips.length === 0) return null;
    return activeFilterChips.join(' · ');
  }, [activeFilterChips]);

  const activeFilterPreview = useMemo(() => {
    if (!displayRunData || !activeFilterPoolIndexSet) return null;
    const isBasicLand = (oracleId: string) => {
      const typeLower = (displayRunData.cardMeta[oracleId]?.type ?? '').toLowerCase();
      return typeLower.includes('basic land');
    };

    const matchingPoolIndices = scopedPools.map((pool) => pool.poolIndex);
    if (matchingPoolIndices.length === 0) return null;

    const selectedFilterOracleIds = new Set(selectedCards.map((card) => card.oracle_id));
    const poolCounts = new Map<string, number>();
    const sideboardOnlyCounts = new Map<string, number>();
    const poolOracleSets = new Map<number, Set<string>>();
    const hasDeckData = !!activeDecks && activeDecks.length === displayedPools.length;

    for (const poolIndex of matchingPoolIndices) {
      const pool = displayedPools[poolIndex];
      if (!pool) continue;
      const poolOracleSet = new Set(
        pool.picks
          .map((pick) => pick.oracle_id)
          .filter((oracleId) => oracleId && !isBasicLand(oracleId) && !selectedFilterOracleIds.has(oracleId)),
      );
      poolOracleSets.set(poolIndex, poolOracleSet);
      for (const oracleId of poolOracleSet) {
        poolCounts.set(oracleId, (poolCounts.get(oracleId) ?? 0) + 1);
      }

      if (hasDeckData) {
        const deck = activeDecks?.[poolIndex];
        if (!deck) continue;
        for (const oracleId of new Set(deck.sideboard)) {
          if (!oracleId || isBasicLand(oracleId) || selectedFilterOracleIds.has(oracleId)) continue;
          if (!deck.mainboard.includes(oracleId)) {
            sideboardOnlyCounts.set(oracleId, (sideboardOnlyCounts.get(oracleId) ?? 0) + 1);
          }
        }
      }
    }

    const toSkeletonCard = ([oracleId, count]: [string, number]): SkeletonCard => ({
      oracle_id: oracleId,
      name: displayRunData.cardMeta[oracleId]?.name || oracleId,
      imageUrl: displayRunData.cardMeta[oracleId]?.imageUrl ?? '',
      fraction: count / matchingPoolIndices.length,
    });

    const commonCards = [...poolCounts.entries()]
      .map(toSkeletonCard)
      .sort((a, b) => b.fraction - a.fraction)
      .slice(0, 8);

    const supportCards: SkeletonCard[] = [];
    const lockCandidates = [...poolCounts.entries()]
      .map(toSkeletonCard)
      .sort((a, b) => b.fraction - a.fraction)
      .slice(0, 24);
    const lockPairs: LockPair[] = [];
    for (let ai = 0; ai < lockCandidates.length; ai++) {
      for (let bi = ai + 1; bi < lockCandidates.length; bi++) {
        const a = lockCandidates[ai]!;
        const b = lockCandidates[bi]!;
        let both = 0;
        for (const poolIndex of matchingPoolIndices) {
          const picks = poolOracleSets.get(poolIndex);
          if (picks?.has(a.oracle_id) && picks.has(b.oracle_id)) both++;
        }
        const rate = both / matchingPoolIndices.length;
        lockPairs.push({
          oracle_id_a: a.oracle_id,
          oracle_id_b: b.oracle_id,
          nameA: a.name,
          nameB: b.name,
          imageUrlA: a.imageUrl,
          imageUrlB: b.imageUrl,
          coOccurrenceRate: rate,
        });
      }
    }
    lockPairs.sort((a, b) => b.coOccurrenceRate - a.coOccurrenceRate);

    const sideboardCards = [...sideboardOnlyCounts.entries()]
      .map(toSkeletonCard)
      .filter((card) => card.fraction >= 0.15)
      .sort((a, b) => b.fraction - a.fraction)
      .slice(0, 5);

    return { commonCards, supportCards, sideboardCards, lockPairs: lockPairs.slice(0, 5) };
  }, [displayRunData, activeFilterPoolIndexSet, scopedPools, activeDecks, displayedPools, selectedCards]);

  const filterChipItems = useMemo(() => {
    const chips: FilterChipItem[] = [];
    for (const selectedCardEntry of selectedCards) {
      chips.push({
        key: `card-${selectedCardEntry.oracle_id}`,
        label: selectedCardEntry.name,
        detail: 'Card',
        onClear: () =>
          setSelectedCardOracles((current) => current.filter((oracleId) => oracleId !== selectedCardEntry.oracle_id)),
      });
    }
    if (selectedSkeletonId !== null) {
      const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
      const skIdx = skeletons.indexOf(sk!);
      if (sk) {
        chips.push({
          key: `cluster-${sk.clusterId}`,
          label: `Cluster ${skIdx + 1}`,
          detail: 'Cluster',
          onClear: () => setSelectedSkeletonId(null),
        });
      }
    }
    if (selectedArchetype) {
      chips.push({
        key: `archetype-${selectedArchetype}`,
        label: archetypeFullName(selectedArchetype),
        detail: 'Color',
        onClear: () => setSelectedArchetype(null),
      });
    }
    if (focusedPoolIndex !== null) {
      const focusedPool = displayedPools.find((pool) => pool.poolIndex === focusedPoolIndex);
      if (focusedPool) {
        chips.push({
          key: `focus-${focusedPoolIndex}`,
          label: `Draft ${focusedPool.draftIndex + 1} · Seat ${focusedPool.seatIndex + 1}`,
          detail: 'Focus',
          onClear: () => setFocusedPoolIndex(null),
        });
      }
    }
    return chips;
  }, [selectedCards, selectedSkeletonId, selectedArchetype, focusedPoolIndex, displayedPools, skeletons]);

  const selectedCardScopeLabel = useMemo(() => {
    if (selectedCards.length === 0) return null;
    const scopeParts: string[] = [];
    if (selectedSkeletonId !== null) {
      const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
      const skIdx = skeletons.indexOf(sk!);
      if (sk) scopeParts.push(`Cluster ${skIdx + 1}`);
    }
    if (selectedArchetype) scopeParts.push(archetypeFullName(selectedArchetype));
    return scopeParts.length > 0 ? scopeParts.join(' · ') : null;
  }, [selectedCards.length, selectedSkeletonId, selectedArchetype, skeletons]);

  const detailedViewTitle = useMemo(() => {
    if (selectedCards.length === 1 && selectedCard)
      return `${selectedCard.name}${selectedCardScopeLabel ? ` in ${selectedCardScopeLabel}` : ''}`;
    if (selectedCards.length === 2)
      return `${selectedCards[0]!.name} + ${selectedCards[1]!.name}${selectedCardScopeLabel ? ` in ${selectedCardScopeLabel}` : ''}`;
    if (selectedCards.length > 2) return `${selectedCards.length} cards`;
    if (selectedSkeletonId !== null) {
      const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
      const skIdx = skeletons.indexOf(sk!);
      return sk ? `Cluster ${skIdx + 1}` : 'Detailed View';
    }
    if (selectedArchetype) return archetypeFullName(selectedArchetype);
    return 'No filter selected';
  }, [selectedCard, selectedCards, selectedCardScopeLabel, selectedSkeletonId, selectedArchetype, skeletons]);

  const detailedViewSubtitle = useMemo(() => {
    const matchingPools = activeFilterPoolIndexSet?.size ?? displayRunData?.slimPools.length ?? 0;
    if (selectedCards.length > 0)
      return `In ${selectedPools.length} draft pool${selectedPools.length !== 1 ? 's' : ''}`;
    if (selectedSkeletonId !== null || selectedArchetype)
      return `${matchingPools} matching draft pool${matchingPools !== 1 ? 's' : ''}`;
    return 'Select a color profile, archetype cluster, or card above to narrow the view.';
  }, [
    activeFilterPoolIndexSet,
    displayRunData,
    selectedCards.length,
    selectedPools.length,
    selectedSkeletonId,
    selectedArchetype,
  ]);

  const clearActiveFilter = useCallback(() => {
    setSelectedCardOracles([]);
    setSelectedArchetype(null);
    setSelectedSkeletonId(null);
    setFocusedPoolIndex(null);
  }, []);

  const handleToggleSelectedCard = useCallback((oracleId: string) => {
    setSelectedCardOracles((current) => {
      if (current.includes(oracleId)) return current.filter((id) => id !== oracleId);
      if (current.length < 2) return [...current, oracleId];
      return [current[1]!, oracleId];
    });
  }, []);

  // Derived filter label for showing active filter in tables
  const cardStatsTitle = useMemo(() => {
    if (selectedCards.length > 0) return 'Card Stats';
    if (selectedSkeletonId !== null) {
      const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
      const skIdx = skeletons.indexOf(sk!);
      return sk ? `Card Stats for Cluster ${skIdx + 1} Drafters` : 'All Card Stats';
    }
    if (selectedArchetype) return `Card Stats for ${archetypeFullName(selectedArchetype)} Drafters`;
    return 'All Card Stats';
  }, [selectedSkeletonId, selectedArchetype, selectedCards.length, skeletons]);

  const showDraftMapScopePanel = selectedSkeletonId !== null || activeFilterPoolIndexSet !== null || selectedCards.length > 0;
  const draftMapScopeSeatCount = activeFilterPoolIndexSet?.size ?? displayRunData?.slimPools.length ?? 0;
  const draftMapScopeSubtitle = activeFilterPoolIndexSet
    ? `${draftMapScopeSeatCount} matching seat${draftMapScopeSeatCount !== 1 ? 's' : ''}`
    : `${draftMapScopeSeatCount} total seat${draftMapScopeSeatCount !== 1 ? 's' : ''}`;
  const showDraftMapOverviewCharts = activeFilterPoolIndexSet === null && selectedSkeletonId === null;

  return (
    <MainLayout>
      <DisplayContextProvider cubeID={cubeId}>
        <CubeLayout cube={cube} activeLink="draft-simulator">
          <Flexbox direction="col" gap="4" className="p-4">
            <DynamicFlash />

            {/* Controls */}
            <Card>
              <CardHeader>
                <Text lg semibold>
                  Draft Simulator
                </Text>
              </CardHeader>
              <CardBody>
                <ul className="mb-4 text-sm text-text-secondary list-disc list-inside space-y-0.5">
                  <li>Simulates bot-only drafts to estimate pick rates, color trends, and archetype outcomes</li>
                  <li>Runs in this browser and stores local history only on this device</li>
                </ul>
                {lastRunTs && (
                  <div className="mb-3">
                    <Text xs className="text-text-secondary">
                      Last run: {new Date(lastRunTs).toLocaleString()}
                    </Text>
                  </div>
                )}
                <Row className="gap-4 flex-wrap items-end">
                  <Col xs={12} sm={4} md={2}>
                    <label className="block text-sm font-medium mb-1">Drafts</label>
                    <NumericInput min={1} value={numDrafts} onChange={setNumDrafts} disabled={isRunning} />
                  </Col>
                  <Col xs={12} sm={4} md={2}>
                    <Select
                      label="Format"
                      id="draftSimulatorFormat"
                      options={availableFormats}
                      value={`${selectedFormatId}`}
                      setValue={(value) => setSelectedFormatId(parseInt(value, 10))}
                      disabled={isRunning}
                    />
                  </Col>
                  <Col xs={12} sm={4} md={2}>
                    <label className="block text-sm font-medium mb-1">Seats</label>
                    <NumericInput min={2} max={16} value={numSeats} onChange={setNumSeats} disabled={isRunning} />
                  </Col>
                  <Col xs={12} sm={4} md={2}>
                    <label className="block text-sm font-medium mb-1">
                      Dead Card Threshold{' '}
                      <Text xs className="text-text-secondary font-normal">
                        (&lt;{deadCardThresholdPct}% pick rate)
                      </Text>
                    </label>
                    <NumericInput
                      min={1}
                      max={100}
                      value={deadCardThresholdPct}
                      onChange={setDeadCardThresholdPct}
                      disabled={isRunning}
                    />
                  </Col>
                  <Col xs={12} sm={4} md={2}>
                    <label className="block text-sm font-medium mb-1" htmlFor="draftSimulatorGpuBatchSize">
                      GPU batch size{' '}
                      <Text xs className="text-text-secondary font-normal">
                        (higher can speed up draft sim on strong GPUs)
                      </Text>
                    </label>
                    <Select
                      id="draftSimulatorGpuBatchSize"
                      options={GPU_BATCH_OPTIONS}
                      value={`${gpuBatchSize}`}
                      setValue={(value) => setGpuBatchSize(parseInt(value, 10))}
                      disabled={isRunning}
                    />
                  </Col>
                  <Col xs={12} sm={12} md={2} className="flex flex-col gap-1">
                    <button
                      onClick={handleStart}
                      disabled={isRunning}
                      className="w-full px-4 py-2 rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium"
                    >
                      {isRunning ? 'Simulating…' : 'Run Simulation'}
                    </button>
                    {isRunning && (
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="w-full px-4 py-1.5 rounded border border-border text-sm text-text-secondary hover:bg-bg-active"
                      >
                        Cancel
                      </button>
                    )}
                  </Col>
                </Row>
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
                <div className="simSection simSectionOverview flex flex-col gap-4">
                  <div className="simSectionHeading flex items-center justify-between gap-3">
                    <Text semibold className="tracking-wide">
                      Overview
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
                      {showDraftMapOverviewCharts && (
                        <>
                          <div className="flex-1 min-w-[180px]">
                            <Card className="h-full">
                              <CardBody className="py-3">
                                <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-2">
                                  Deck Color Share
                                </Text>
                                <DeckColorShareChart deckBuilds={filteredDecks} cardMeta={displayRunData.cardMeta} />
                              </CardBody>
                            </Card>
                          </div>
                          <div className="flex-1 min-w-[180px]">
                            <Card className="h-full">
                              <CardBody className="py-3">
                                <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-2">
                                  Mana Curve Share
                                </Text>
                                <ManaCurveShareChart deckBuilds={filteredDecks} cardMeta={displayRunData.cardMeta} />
                              </CardBody>
                            </Card>
                          </div>
                        </>
                      )}
                    </Flexbox>
                  </Collapse>
                </div>
                <ActiveFilterBar
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
                />
                <div className="simSection simSectionCards flex flex-col gap-5 pt-2">
                  <Flexbox direction="col" gap="4">
                    <div className="simCardDiagBlock simCardDiagSummary flex flex-col gap-4">
                        {/* Draft Map — full width, with cluster detail panel on the right when selected */}
                        {draftMapPoints.length > 0 && (
                          <Card className="border-border">
                            <CardHeader>
                              <Flexbox direction="row" justify="between" alignItems="center" className="flex-wrap gap-2">
                                <div>
                                  <Text semibold>Draft Map{skeletons.length > 0 ? ` · ${skeletons.length} clusters` : ''}</Text>
                                  <div className="mt-0.5">
                                    <Text xs className="text-text-secondary">
                                      UMAP projection of deck embeddings. Click a point to focus its deck.
                                    </Text>
                                  </div>
                                </div>
                                <div className="flex flex-row items-center gap-2 flex-shrink-0 flex-wrap">
                                  <div className="flex flex-row items-center gap-1">
                                    <label className="text-xs font-medium text-text-secondary whitespace-nowrap mr-1">Color by</label>
                                    <button
                                      type="button"
                                      onClick={() => setDraftMapColorMode('cluster')}
                                      className={[
                                        'px-2 py-0.5 rounded text-xs font-medium border transition-colors',
                                        draftMapColorMode === 'cluster'
                                          ? 'bg-link text-white border-link'
                                          : 'bg-bg-accent border-border hover:bg-bg-active text-text-secondary',
                                      ].join(' ')}
                                    >
                                      Cluster
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDraftMapColorMode('deckColor')}
                                      className={[
                                        'px-2 py-0.5 rounded text-xs font-medium border transition-colors',
                                        draftMapColorMode === 'deckColor'
                                          ? 'bg-link text-white border-link'
                                          : 'bg-bg-accent border-border hover:bg-bg-active text-text-secondary',
                                      ].join(' ')}
                                    >
                                      Deck Color
                                    </button>
                                  </div>
                                  <div className="flex flex-row items-center gap-1">
                                    <label className="text-xs font-medium text-text-secondary whitespace-nowrap">Min Size</label>
                                    <NumericInput min={2} max={20} value={pendingMinClusterSize} onChange={setPendingMinClusterSize} className="w-14" />
                                    <button
                                      type="button"
                                      disabled={clusteringInProgress}
                                      onClick={() => {
                                        setMinClusterSize(pendingMinClusterSize);
                                        setSelectedSkeletonId(null);
                                        setFocusedPoolIndex(null);
                                        setClusterSeed((s) => s + 1);
                                      }}
                                      className={[
                                        'whitespace-nowrap px-2 py-0.5 rounded text-xs font-medium border',
                                        clusteringInProgress
                                          ? 'bg-bg-accent border-border text-text-secondary cursor-wait'
                                          : 'bg-bg-accent border-border hover:bg-bg-active',
                                      ].join(' ')}
                                    >
                                      {clusteringInProgress ? (
                                        <span className="flex items-center gap-1">
                                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                          </svg>
                                          Clustering…
                                        </span>
                                      ) : 'Re-cluster'}
                                    </button>
                                  </div>
                                </div>
                              </Flexbox>
                            </CardHeader>
                            <CardBody>
                              <div className="grid grid-cols-2 gap-6 items-start">
                                <div className={`relative ${showDraftMapScopePanel ? '' : 'col-span-2'}`}
                                  style={{ aspectRatio: '1 / 1', width: showDraftMapScopePanel ? '100%' : 'calc(50% - 0.75rem)', ...(!showDraftMapScopePanel ? { margin: '0 auto' } : {}) }}>
                                  {clusteringInProgress && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/60 rounded backdrop-blur-sm">
                                      <div className="flex flex-col items-center gap-2">
                                        <svg className="animate-spin h-8 w-8 text-link" viewBox="0 0 24 24" fill="none">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        <Text xs className="text-text-secondary">Clustering…</Text>
                                      </div>
                                    </div>
                                  )}
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
                                </div>
                                {showDraftMapScopePanel && (
                                  <div className="min-w-0 flex flex-col gap-3">
                                    {selectedCards.length > 0 && (() => {
                                      const statsForScope = activeFilterPoolIndexSet
                                        ? selectedCardStats
                                        : (selectedCardStats ?? selectedCard);
                                      return (
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
                                                    Pick rate{' '}
                                                    <span className="text-text-secondary/80">
                                                      {`${(statsForScope.pickRate * 100).toFixed(1)}%`}
                                                    </span>
                                                  </span>
                                                  <span className="text-xs text-text-secondary/50 font-medium">
                                                    Avg position{' '}
                                                    <span className="text-text-secondary/80">
                                                      {statsForScope.avgPickPosition > 0
                                                        ? statsForScope.avgPickPosition.toFixed(1)
                                                        : '—'}
                                                    </span>
                                                  </span>
                                                </Flexbox>
                                              )}
                                            </div>
                                            <button
                                              type="button"
                                              className="flex-shrink-0 text-xs text-text-secondary hover:text-text"
                                              onClick={() => setSelectedCardOracles([])}
                                            >
                                              ✕
                                            </button>
                                          </Flexbox>
                                        </div>
                                      );
                                    })()}
                                    {selectedSkeletonId !== null ? (() => {
                                      const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
                                      const skIdx = skeletons.indexOf(sk!);
                                      const clusterDecks = sk && activeDecks
                                        ? sk.poolIndices.map((i) => activeDecks[i]).filter(Boolean)
                                        : null;
                                      return sk ? (
                                        <ClusterDetailPanel
                                          skeleton={sk}
                                          clusterIndex={skIdx}
                                          totalPools={displayRunData.slimPools.length}
                                          clusterDeckBuilds={clusterDecks}
                                          cardMeta={displayRunData.cardMeta}
                                          commonCards={activeFilterPreview?.commonCards ?? []}
                                          onClose={() => {
                                            setSelectedSkeletonId(null);
                                            setFocusedPoolIndex(null);
                                          }}
                                        />
                                      ) : null;
                                    })() : activeFilterPoolIndexSet !== null && (
                                      <DraftMapScopePanel
                                        title={activeFilterSummary ?? 'All draft pools'}
                                        subtitle={draftMapScopeSubtitle}
                                        commonCards={activeFilterPreview?.commonCards ?? []}
                                        deckBuilds={filteredDecks}
                                        cardMeta={displayRunData.cardMeta}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            </CardBody>
                          </Card>
                        )}
                        {/* Deck Color Distribution — full width */}
                        <Card>
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
                              <Flexbox direction="row" gap="2" alignItems="center" className="flex-wrap">
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
                                <button
                                  type="button"
                                  onClick={() => setDeckColorOpen((o) => !o)}
                                  className="whitespace-nowrap px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active"
                                >
                                  {deckColorOpen ? '▲ Hide' : '▼ Show'}
                                </button>
                              </Flexbox>
                            </Flexbox>
                          </CardHeader>
                          <Collapse isOpen={deckColorOpen}>
                            <CardBody>
                              <ArchetypeChart
                                archetypeDistribution={displayedArchetypeDistribution}
                                selectedArchetype={selectedArchetype}
                                onSelect={(cp) => {
                                  setSelectedArchetype(cp);
                                  setSelectedSkeletonId(null);
                                }}
                              />
                            </CardBody>
                          </Collapse>
                        </Card>
                        {/* Archetypes list — full width */}
                        {skeletons.length > 0 && (
                          <ArchetypeSkeletonSection
                            skeletons={skeletons}
                            totalPools={displayRunData.slimPools.length}
                            selectedSkeletonId={selectedSkeletonId}
                            onSelectSkeleton={(id) => {
                              setSelectedSkeletonId(id);
                              setSelectedArchetype(null);
                            }}
                            isOpen={archetypesOpen}
                            onToggle={() => setArchetypesOpen((o) => !o)}
                          />
                        )}
                    </div>
                    <div ref={cardStatsRef} className="simCardDiagBlock simCardDiagTable order-last flex flex-col gap-5">
                      <Card className="border-border">
                        <CardHeader>
                          <Flexbox direction="row" justify="between" alignItems="center">
                            <div>
                              <Flexbox direction="row" gap="2" alignItems="center" className="flex-wrap">
                                <Text semibold>{cardStatsTitle}</Text>
                                {filterChipItems.map((chip) => (
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
                            <CardStatsTable
                              cardStats={visibleCardStats}
                              cardMeta={displayRunData.cardMeta}
                              deadCardThreshold={displayRunData.deadCardThreshold}
                              onSelectCard={handleToggleSelectedCard}
                              selectedCardOracles={selectedCardOracles}
                              inDeckOracles={inDeckOracles}
                              inSideboardOracles={inSideboardOracles}
                              deckInclusionPct={deckInclusionPct}
                              visiblePoolCounts={visiblePoolCounts}
                              onPageChange={() =>
                                cardStatsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                              }
                            />
                          </CardBody>
                        </Collapse>
                      </Card>
                    </div>
                    <div
                      ref={detailedViewRef}
                      className="simCardDiagBlock simCardDiagDetailArea order-first flex flex-col gap-3 pt-2"
                    >
                      <div className="simSectionHeading flex items-center justify-between gap-3">
                        <Text semibold className="tracking-wide">
                          Detailed View
                        </Text>
                        <button
                          type="button"
                          onClick={() => setDetailedViewOpen((open) => !open)}
                          className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active"
                        >
                          {detailedViewOpen ? '▲ Hide' : '▼ Show'}
                        </button>
                      </div>
                      <Collapse isOpen={detailedViewOpen}>
                        <Flexbox direction="col" gap="5">
                          {/* Zero-intersection warning */}
                          {activeFilterPoolIndexSet !== null && activeFilterPoolIndexSet.size === 0 && (
                            <div className="rounded-lg border border-yellow-500 bg-yellow-500/10 px-4 py-3 flex items-center justify-between gap-3">
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
                          {hasApproximateFilteredStats && (
                            <div className="rounded-lg border border-yellow-500 bg-yellow-500/10 px-4 py-3">
                              <Text sm className="text-text">
                                Exact card-stat filtering requires pack sequence data that wasn't stored for this run.
                                Deck and draft breakdowns are filtered correctly; card-level stats approximate the full
                                run.
                              </Text>
                            </div>
                          )}
                        </Flexbox>
                      </Collapse>
                    </div>
                  </Flexbox>
                </div>
                <div className="simSection simSectionDraftBreakdown flex flex-col gap-4 pt-3 border-t border-border">
                  <div className="simSectionHeading flex items-center justify-between gap-3">
                    <Flexbox direction="row" gap="2" alignItems="center" className="flex-wrap">
                      <Text semibold className="tracking-wide">
                        Draft Breakdown
                      </Text>
                      {filterChipItems.map((chip) => (
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
                    </Flexbox>
                    <button
                      type="button"
                      onClick={() => setDraftBreakdownOpen((open) => !open)}
                      className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active flex-shrink-0"
                    >
                      {draftBreakdownOpen ? '▲ Hide' : '▼ Show'}
                    </button>
                  </div>
                  <Collapse isOpen={draftBreakdownOpen}>
                    <DraftBreakdownTable
                      pools={activeFilterPoolIndexSet !== null ? displayedPools.filter((p) => activeFilterPoolIndexSet.has(p.poolIndex)) : displayedPools}
                      deckBuilds={activeDecks}
                      deckLoading={simPhase === 'deckbuild'}
                      cardMeta={displayRunData.cardMeta}
                      runData={displayRunData}
                      viewMode={focusedPoolViewMode}
                      setViewMode={setFocusedPoolViewMode}
                      highlightOracle={selectedCard?.oracle_id}
                      showLocationFilter={!!selectedCard}
                      selectedCardName={selectedCard?.name}
                      filteredCards={selectedCards}
                      focusedPoolIndex={focusedPoolIndex}
                    />
                  </Collapse>
                </div>
                <DraftVsEloTable cardStats={displayRunData.cardStats} />
                <Text xs className="text-text-secondary text-right">
                  Generated {new Date(displayRunData.generatedAt).toLocaleString()}
                </Text>
              </Flexbox>
            )}

            <div className="simSection simSectionReference flex flex-col gap-4 pt-3 border-t border-border">
              <div className="simSectionHeading flex items-center justify-between gap-3">
                <Text semibold className="tracking-wide">
                  Reference
                </Text>
                <button
                  type="button"
                  onClick={() => setReferenceOpen((open) => !open)}
                  className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active"
                >
                  {referenceOpen ? '▲ Hide' : '▼ Show'}
                </button>
              </div>
              <Collapse isOpen={referenceOpen}>
                <Flexbox direction="col" gap="4">
                  {/* Run history */}
                  {runs.length > 0 && (
                    <Card>
                      <CardHeader>
                        <Flexbox direction="row" justify="between" alignItems="center" className="w-full gap-3">
                          <Text semibold>Local Simulation History</Text>
                          <Button color="secondary" onClick={() => setClearHistoryModalOpen(true)}>
                            Clear History
                          </Button>
                        </Flexbox>
                      </CardHeader>
                      <CardBody>
                        <div className="overflow-x-auto rounded border border-border bg-bg">
                          <table className="min-w-full divide-y divide-border text-sm">
                            <thead className="bg-bg-accent">
                              <tr>
                                {['Date', 'Drafts', 'Dead Cards', ''].map((h) => (
                                  <th
                                    key={h}
                                    className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider"
                                  >
                                    {h}
                                  </th>
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
                                    run.ts === selectedTs
                                      ? 'bg-bg-active font-semibold border-l-2 border-link'
                                      : 'hover:bg-bg-active border-l-2 border-transparent',
                                  ].join(' ')}
                                >
                                  <td className="px-3 py-2">{new Date(run.generatedAt).toLocaleString()}</td>
                                  <td className="px-3 py-2 text-text-secondary">
                                    {run.numDrafts} × {run.numSeats} seats
                                  </td>
                                  <td className="px-3 py-2 text-text-secondary">
                                    {run.deadCardCount > 0 ? (
                                      <span className="text-red-400">{run.deadCardCount}</span>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      type="button"
                                      className="px-2 py-0.5 rounded text-xs font-medium border bg-bg border-border text-text-secondary hover:bg-bg-active"
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
                        {loadingRun && (
                          <Text xs className="text-text-secondary mt-2">
                            Loading run…
                          </Text>
                        )}
                      </CardBody>
                    </Card>
                  )}
                  <SimulatorExplainer />
                </Flexbox>
              </Collapse>
            </div>
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
              setOpen={(open) => {
                setLeaveModalOpen(open);
                if (!open) setPendingNavigationHref(null);
              }}
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
          After deckbuilding, each built deck is grouped with other similar decks to surface recurring deck families.
          This is an approximate similarity-based view, not a claim that every deck belongs cleanly to a single
          archetype. Clustering uses main-deck cards so the focus stays on what actually made the final 40/60.
        </p>
        <ol className="list-decimal list-inside space-y-1.5 ml-2">
          <li>
            <span className="font-medium text-text">ML embeddings</span> — each main deck is encoded into a 128-dimensional
            vector by the same neural-network draft model that powers the bot picks. These embeddings capture card
            synergies and archetype signals learned from millions of real drafts.
          </li>
          <li>
            <span className="font-medium text-text">UMAP projection</span> — the 128-dim embeddings are projected down
            to 2D using a force-directed layout seeded from PCA. Nearby points in 2D share similar deck structure.
            This is also the scatter plot shown in the Draft Map.
          </li>
          <li>
            <span className="font-medium text-text">HDBSCAN clustering</span> — a density-based algorithm finds
            clusters in the 2D projection using mutual reachability distances. Unlike k-means, HDBSCAN discovers the
            number of clusters automatically based on local density. <em>Min Size</em> controls the smallest group it
            will call a cluster — raising it merges smaller groups into larger ones.
          </li>
          <li>
            <span className="font-medium text-text">k-means fallback</span> — if the data is too uniform for HDBSCAN
            to find density-based structure (everything collapses to one cluster), the system automatically falls back
            to k-means on the 2D coordinates so you always get meaningful groups.
          </li>
        </ol>
        <p>
          When ML embeddings are unavailable (e.g. model not loaded), the system falls back to TF-IDF vectors — binary
          card presence weighted by inverse document frequency and L2-normalised.
        </p>
        <p>Each cluster shows:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>
            <span className="font-medium text-text">Defining cards</span> — the top 12 cards that appear most often in
            decks in that cluster
          </li>
          <li>
            <span className="font-medium text-text">Deck Color Share</span> — the color identity breakdown of mainboard
            cards across all decks in the cluster
          </li>
          <li>
            <span className="font-medium text-text">Mana Curve Share</span> — the CMC distribution of non-land mainboard
            cards in the cluster
          </li>
        </ul>
        <p>
          The cluster color label shown on the map and detail panel is computed from the actual deck color share — a
          color must represent at least 10% of mainboard card identity to be included in the label.
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
