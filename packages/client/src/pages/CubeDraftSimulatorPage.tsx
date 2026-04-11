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

import { Card, CardBody, CardHeader } from '../components/base/Card';
import Button from '../components/base/Button';
import Collapse from '../components/base/Collapse';
import Input from '../components/base/Input';
import { Col, Flexbox, Row } from '../components/base/Layout';
import Link from '../components/base/Link';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../components/base/Modal';
import Select from '../components/base/Select';
import Text from '../components/base/Text';
import DynamicFlash from '../components/DynamicFlash';
import DraftBreakdownDisplay from '../components/draft/DraftBreakdownDisplay';
import ConfirmDeleteModal from '../components/modals/ConfirmDeleteModal';
import RenderToRoot from '../components/RenderToRoot';
import withAutocard from '../components/WithAutocard';
import { CSRFContext } from '../contexts/CSRFContext';
import { DisplayContextProvider } from '../contexts/DisplayContext';
import CubeLayout from '../layouts/CubeLayout';
import MainLayout from '../layouts/MainLayout';
import {
  buildOracleRemapping,
  DeckbuildEntry,
  loadDraftBot,
  localBatchDeckbuild,
  localBatchDraftRanked,
  localPickBatch,
  WebGLInferenceError,
} from '../utils/draftBot';
import { modelScoresToProbabilities } from '../utils/botRatings';
import { computeSkeletons } from '../utils/draftSimulatorClustering';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, ScatterController, Tooltip, Legend);

const AutocardLink = withAutocard(Link);

const renderAutocardNameLink = (oracleId: string, name: string) => (
  <AutocardLink
    href={`/tool/card/${oracleId}`}
    className="text-inherit hover:text-link hover:underline"
    card={{ details: { oracle_id: oracleId, name } } as any}
  >
    {name}
  </AutocardLink>
);

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
  const desiredKeys = new Set(nextRuns.slice(0, LOCAL_SIM_HISTORY_LIMIT).map((run) => localSimulationStorageKey(cubeId, run.entry.ts)));
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
        <Text>
          A simulation is still running. If you leave this page now, the current run will be interrupted.
        </Text>
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
  const colors = Object.keys(colorCounts)
    .filter((c) => (colorCounts[c] ?? 0) / count >= 0.25)
    .sort();
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
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2">
          <span className="w-16 text-xs text-text-secondary text-right flex-shrink-0">{r.label}</span>
          <div className="flex-1 rounded overflow-hidden h-5" style={{ background: 'var(--color-bg-accent)' }}>
            <div className="h-full rounded" style={{ width: `${(r.pct * 100).toFixed(1)}%`, background: r.bg }} />
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
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-2">
          <span className="w-10 text-xs text-text-secondary text-right flex-shrink-0">{row.label}</span>
          <div className="flex-1 rounded overflow-hidden h-5" style={{ background: 'var(--color-bg-accent)' }}>
            <div
              className="h-full rounded"
              style={{
                width: `${(row.pct * 100).toFixed(1)}%`,
                background: 'linear-gradient(90deg, #475569 0%, #64748b 100%)',
              }}
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
  const pointData = picked.map((c) => ({
    x: Math.round(c.elo),
    y: Math.round(c.avgPickPosition * 10) / 10,
    label: c.name,
  }));
  const pointColors = picked.map((c) => {
    const colors = c.colorIdentity.filter((x) => x in MTG_COLORS);
    if (colors.length === 0) return MTG_COLORS.C!.bg;
    if (colors.length === 1) return MTG_COLORS[colors[0]!]!.bg;
    return MTG_COLORS.M!.bg;
  });
  return (
    <Scatter
      data={{
        datasets: [
          { label: 'Cards', data: pointData, backgroundColor: pointColors, pointRadius: 4, pointHoverRadius: 6 },
        ],
      }}
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
          y: {
            reverse: true,
            beginAtZero: false,
            suggestedMin: 1,
            suggestedMax: Math.max(15, Math.ceil(maxAvgPick)),
            title: { display: true, text: 'Average Pick Position' },
          },
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
            {showHiddenProfiles ? 'Show fewer' : 'Show all color profiles'}
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
  deadCardThreshold,
  onSelectCard,
  selectedCardOracles,
  inDeckOracles,
  inSideboardOracles,
  deckInclusionPct,
  visiblePoolCounts,
  onPageChange,
}) => {
  const PAGE_SIZE = 25;
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
                  <td className="px-3 py-2 font-medium">{renderAutocardNameLink(c.oracle_id, c.name)}</td>
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
  }, [pool.poolIndex]);

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
const DECK_CARD_W = SIM_PREVIEW_CARD_W;
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
    return (
      picksByOracle[id] ?? {
        oracle_id: id,
        name: meta?.name ?? id,
        imageUrl: meta?.imageUrl ?? '',
        packNumber: 0,
        pickNumber: 0,
      }
    );
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
              <Text xs className="text-text-secondary mb-1 font-semibold uppercase tracking-wider">
                {rowLabels[rowIdx]}
              </Text>
              <div className="flex flex-row gap-1">
                {row.map((stack, colIdx) => {
                  if (stack.length === 0) return <div key={colIdx} style={{ width: DECK_CARD_W }} />;
                  const stackH = Math.round(DECK_CARD_W * 1.4) + (stack.length - 1) * STACK_OFFSET;
                  return (
                    <div key={colIdx} className="relative flex-shrink-0" style={{ width: DECK_CARD_W, height: stackH }}>
                      {stack.map((pick, i) => (
                        <div
                          key={`${pick.oracle_id}-${i}`}
                          className={[
                            'absolute rounded border overflow-hidden',
                            pick.oracle_id === highlightOracle
                              ? 'border-link-active ring-1 ring-link-active'
                              : 'border-border',
                          ].join(' ')}
                          style={{ top: i * STACK_OFFSET, width: DECK_CARD_W, zIndex: i }}
                        >
                          {pick.imageUrl ? (
                            <img src={pick.imageUrl} alt={pick.name} className="w-full block" />
                          ) : (
                            <div
                              className="w-full flex items-center justify-center p-1 text-xs text-text-secondary bg-bg"
                              style={{ height: Math.round(DECK_CARD_W * 1.4) }}
                            >
                              {pick.name}
                            </div>
                          )}
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
            <Text xs className="text-text-secondary mb-1 font-semibold uppercase tracking-wider">
              Sideboard ({sideboardPicks.length})
            </Text>
            <div className="flex flex-row flex-wrap gap-1 opacity-75">
              {sideboardPicks.map((pick) => (
                <div
                  key={pick.oracle_id}
                  className="rounded border border-border overflow-hidden flex-shrink-0"
                  style={{ width: 110 }}
                >
                  {pick.imageUrl ? (
                    <img src={pick.imageUrl} alt={pick.name} className="w-full block" />
                  ) : (
                    <div className="text-xs p-1 text-text-secondary bg-bg" style={{ height: 154 }}>
                      {pick.name}
                    </div>
                  )}
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
  mode: PoolViewMode;
  deck: BuiltDeck | null;
  cardMeta: Record<string, CardMeta>;
  runData: SimulationRunData;
  highlightOracle?: string;
}> = ({ pool, mode, deck, cardMeta, runData, highlightOracle }) => {
  if (mode === 'deck' && deck && (deck.mainboard.length > 0 || deck.sideboard.length > 0)) {
    const picksByOracle: Record<string, SimulatedPickCard> = {};
    for (const pick of pool.picks) picksByOracle[pick.oracle_id] = pick;
    return (
      <SimDeckView deck={deck} picksByOracle={picksByOracle} cardMeta={cardMeta} highlightOracle={highlightOracle} />
    );
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

const POOL_PAGE_SIZE = 20;

const CardPoolView: React.FC<{
  card: CardStats;
  pools: SimulatedPool[];
  deckBuilds: BuiltDeck[] | null;
  deckLoading: boolean;
  cardMeta: Record<string, CardMeta>;
  runData: SimulationRunData;
  onClose: () => void;
}> = ({ card, pools, deckBuilds, deckLoading, cardMeta, runData, onClose }) => {
  const [expandedPool, setExpandedPool] = useState<number | null>(pools[0]?.poolIndex ?? null);
  const [viewMode, setViewMode] = useState<PoolViewMode>('deck');
  const [poolLocationFilter, setPoolLocationFilter] = useState<DeckLocationFilter>('all');
  const [poolPage, setPoolPage] = useState(1);
  const hasDeck = !!deckBuilds && deckBuilds.length > 0;
  const hasFullPickOrder = !!runData.setupData;

  const visiblePools = pools.filter((pool) => {
    if (!deckBuilds || poolLocationFilter === 'all') return true;
    const d = deckBuilds[pool.poolIndex];
    if (!d) return true;
    if (poolLocationFilter === 'deck') return d.mainboard.includes(card.oracle_id);
    if (poolLocationFilter === 'sideboard') return d.sideboard.includes(card.oracle_id);
    return true;
  });

  const totalPoolPages = Math.max(1, Math.ceil(visiblePools.length / POOL_PAGE_SIZE));
  const pagedPools = visiblePools.slice((poolPage - 1) * POOL_PAGE_SIZE, poolPage * POOL_PAGE_SIZE);

  // Reset page when filter changes
  useEffect(() => {
    setPoolPage(1);
  }, [poolLocationFilter]);

  return (
    <Card className="border-border">
      <CardHeader>
        <Flexbox direction="row" justify="between" alignItems="center" className="flex-wrap gap-3">
          <div>
            <Text semibold>Draft Breakdown</Text>
            <div className="mt-0.5">
              <Text xs className="text-text-secondary">
                Matching decks that include {card.name}
              </Text>
            </div>
          </div>
          <Flexbox direction="row" gap="3" alignItems="center" className="flex-wrap">
            {hasDeck && (
              <Flexbox
                direction="row"
                gap="1"
                className="flex-wrap rounded border border-border bg-bg-accent/70 px-2 py-1"
              >
                {(['all', 'deck', 'sideboard'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPoolLocationFilter(v)}
                    className={[
                      'px-2 py-0.5 rounded text-xs font-medium border',
                      poolLocationFilter === v
                        ? 'bg-link text-white border-link'
                        : 'bg-bg text-text-secondary border-border hover:bg-bg-active',
                    ].join(' ')}
                  >
                    {v === 'all' ? 'In pool' : v === 'deck' ? 'In deck' : 'In sideboard'}
                  </button>
                ))}
              </Flexbox>
            )}
            <Flexbox
              direction="row"
              gap="1"
              className="flex-wrap rounded border border-border bg-bg-accent/70 px-2 py-1"
            >
              <ViewToggle
                mode={viewMode}
                onChange={setViewMode}
                hasDeck={hasDeck}
                hasFullPickOrder={hasFullPickOrder}
                deckLoading={deckLoading}
              />
            </Flexbox>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close draft breakdown"
              className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active"
              title="Close"
            >
              ✕
            </button>
          </Flexbox>
        </Flexbox>
      </CardHeader>
      <CardBody className="pt-3">
        {visiblePools.length === 0 ? (
          <Text sm className="text-text-secondary">
            No pools match the current filter.
          </Text>
        ) : (
          <Flexbox direction="col" gap="4">
            {pagedPools.map((pool) => {
              const isExpanded = expandedPool === pool.poolIndex;
              const orderedPicks = [...pool.picks].sort(
                (a, b) => a.packNumber - b.packNumber || a.pickNumber - b.pickNumber,
              );
              const thisCardPick = orderedPicks.find((p) => p.oracle_id === card.oracle_id);
              const pickLabel = thisCardPick ? `P${thisCardPick.packNumber + 1}P${thisCardPick.pickNumber}` : '';
              return (
                <div
                  key={pool.poolIndex}
                  className="rounded-lg border border-border/80 overflow-hidden bg-bg shadow-sm"
                >
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-3 px-3 py-3 bg-bg-accent/60 hover:bg-bg-active text-left border-b border-border/70"
                    onClick={() => setExpandedPool(isExpanded ? null : pool.poolIndex)}
                  >
                    <Flexbox direction="row" gap="2" alignItems="center" className="flex-wrap min-w-0">
                      <Text sm semibold>
                        Draft {pool.draftIndex + 1} · Seat {pool.seatIndex + 1}
                      </Text>
                      <span className="text-[11px] bg-bg text-text-secondary rounded px-1.5 py-0.5 border border-border/80">
                        {pool.archetype}
                      </span>
                      {pickLabel && (
                        <span className="text-[11px] bg-link/15 text-link rounded px-1.5 py-0.5 font-semibold border border-link/20">
                          {card.name} @ {pickLabel}
                        </span>
                      )}
                    </Flexbox>
                    <Text xs className="text-text-secondary flex-shrink-0">
                      {isExpanded ? '▲' : '▼'} {pool.picks.length} picks
                    </Text>
                  </button>
                  {isExpanded && (
                    <PoolExpansionContent
                      pool={pool}
                      mode={viewMode}
                      deck={deckBuilds?.[pool.poolIndex] ?? null}
                      cardMeta={cardMeta}
                      runData={runData}
                      highlightOracle={card.oracle_id}
                    />
                  )}
                </div>
              );
            })}
            {totalPoolPages > 1 && (
              <Flexbox direction="row" justify="between" alignItems="center" className="pt-1">
                <Text xs className="text-text-secondary">
                  Page {poolPage} / {totalPoolPages} · {visiblePools.length} pools
                </Text>
                <Flexbox direction="row" gap="2">
                  <button
                    type="button"
                    onClick={() => setPoolPage((p) => Math.max(1, p - 1))}
                    disabled={poolPage === 1}
                    className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPoolPage((p) => Math.min(totalPoolPages, p + 1))}
                    disabled={poolPage === totalPoolPages}
                    className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </Flexbox>
              </Flexbox>
            )}
          </Flexbox>
        )}
      </CardBody>
    </Card>
  );
};

const ArchetypePoolList: React.FC<{
  archetype: string;
  title?: string;
  pools: SimulatedPool[];
  deckBuilds: BuiltDeck[] | null;
  deckLoading: boolean;
  cardMeta: Record<string, CardMeta>;
  runData: SimulationRunData;
  onClose: () => void;
}> = ({ archetype, title, pools, deckBuilds, deckLoading, cardMeta, runData, onClose }) => {
  const [expandedPool, setExpandedPool] = useState<number | null>(null);
  const hasDeck = !!deckBuilds && deckBuilds.length > 0;
  const hasFullPickOrder = !!runData.setupData;
  const [viewMode, setViewMode] = useState<PoolViewMode>('pool');
  useEffect(() => {
    if (hasDeck) setViewMode('deck');
  }, [hasDeck]);
  return (
    <Card className="border-border">
      <CardHeader>
        <Flexbox direction="row" justify="between" alignItems="center" className="flex-wrap gap-3">
          <div className="min-w-0">
            <div>
              <Text semibold>Draft Breakdown</Text>
            </div>
            <div className="mt-0.5">
              <Text xs className="text-text-secondary">
                {title ?? archetypeFullName(archetype)} · {pools.length} seats
              </Text>
            </div>
          </div>
          <Flexbox
            direction="row"
            gap="2"
            alignItems="center"
            className="flex-wrap rounded border border-border bg-bg-accent/60 px-2 py-1"
          >
            <ViewToggle
              mode={viewMode}
              onChange={setViewMode}
              hasDeck={hasDeck}
              hasFullPickOrder={hasFullPickOrder}
              deckLoading={deckLoading}
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close archetype draft breakdown"
              className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active"
              title="Close"
            >
              ✕
            </button>
          </Flexbox>
        </Flexbox>
      </CardHeader>
      <CardBody className="pt-2">
        <Flexbox direction="col" gap="3">
          {pools.map((pool) => {
            const isExpanded = expandedPool === pool.poolIndex;
            return (
              <div key={pool.poolIndex} className="rounded-lg border border-border/80 overflow-hidden bg-bg shadow-sm">
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-bg-accent/60 hover:bg-bg-active text-left border-b border-border/70"
                  onClick={() => setExpandedPool(isExpanded ? null : pool.poolIndex)}
                >
                  <Flexbox direction="row" gap="2" alignItems="center" className="flex-wrap min-w-0">
                    <Text sm semibold>
                      Draft {pool.draftIndex + 1} · Seat {pool.seatIndex + 1}
                    </Text>
                    <span className="text-[11px] bg-bg text-text-secondary rounded px-1.5 py-0.5 border border-border/80">
                      {pool.archetype}
                    </span>
                  </Flexbox>
                  <Text xs className="text-text-secondary flex-shrink-0">
                    {isExpanded ? '▲' : '▼'} {pool.picks.length} picks
                  </Text>
                </button>
                {isExpanded && (
                  <PoolExpansionContent
                    pool={pool}
                    mode={viewMode}
                    deck={deckBuilds?.[pool.poolIndex] ?? null}
                    cardMeta={cardMeta}
                    runData={runData}
                  />
                )}
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
    <Row className="gap-4">
      {[
        {
          title: 'Overperformers',
          sub: 'Picked higher than Elo suggests — stronger in this cube than their global rating implies',
          data: gainers,
        },
        {
          title: 'Underperformers',
          sub: 'High Elo but drafted later — may be situational or a poor fit for this cube',
          data: losers,
        },
      ].map(({ title, sub, data }) => (
        <Col key={title} xs={12} md={6}>
          <Card className="h-full">
            <CardHeader>
              <div>
                <div>
                  <Text semibold>{title}</Text>
                </div>
                <div className="mt-0.5">
                  <Text xs className="text-text-secondary">
                    {sub}
                  </Text>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              <div className="overflow-x-auto rounded border border-border bg-bg">
                <table className="min-w-full divide-y divide-border text-sm">
                  <TH />
                  <tbody className="divide-y divide-border">
                    {data.map((row) => (
                      <DR key={row.oracle_id} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

const SkeletonCardImage: React.FC<{ card: SkeletonCard; size: number }> = ({ card, size }) => (
  <AutocardLink
    href={`/tool/card/${card.oracle_id}`}
    className="relative flex-shrink-0 block hover:opacity-95"
    style={{ width: size }}
    title={`${card.name} — ${(card.fraction * 100).toFixed(0)}% of pools`}
    card={{ details: { oracle_id: card.oracle_id, name: card.name, image_normal: card.imageUrl } } as any}
  >
    {card.imageUrl ? (
      <img src={card.imageUrl} alt={card.name} className="w-full rounded border border-border shadow-sm" />
    ) : (
      <div
        className="w-full flex items-center justify-center text-xs text-text-secondary bg-bg-accent rounded border border-border p-1 text-center shadow-sm"
        style={{ height: Math.round(size * 1.4) }}
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
    href={`/tool/card/${oracleId}`}
    className="relative flex-shrink-0 block hover:opacity-95"
    style={{ width: size }}
    card={{ details: { oracle_id: oracleId, name, image_normal: imageUrl } } as any}
  >
    <img src={imageUrl} alt={name} className="w-full rounded border border-border shadow-sm" />
  </AutocardLink>
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
}> = ({
  skeletons,
  k,
  onSetK,
  coreThreshold,
  onSetCoreThreshold,
  onRecluster,
  totalPools,
  selectedSkeletonId,
  onSelectSkeleton,
  isOpen,
  onToggle,
}) => (
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
}> = ({
  skeletons,
  k,
  onSetK,
  coreThreshold,
  onSetCoreThreshold,
  onRecluster,
  totalPools,
  selectedSkeletonId,
  onSelectSkeleton,
  isOpen,
  onToggle,
}) => {
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
    <div
      key={skeleton.clusterId}
      className={[
        'rounded-lg overflow-hidden border bg-bg shadow-sm',
        selectedSkeletonId === skeleton.clusterId ? 'border-link-active ring-1 ring-link-active' : 'border-border/80',
      ].join(' ')}
    >
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
          <span className="text-xs bg-yellow-500/15 text-text border border-yellow-500/60 rounded px-2 py-0.5">
            <span
              className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-yellow-500 text-black font-bold mr-1"
              style={{ fontSize: 9 }}
            >
              !
            </span>
            {skeleton.lockPairs.length} lock pair{skeleton.lockPairs.length > 1 ? 's' : ''}
          </span>
        )}
        {selectedSkeletonId === skeleton.clusterId && (
          <span className="text-xs bg-link/20 text-link border border-link/30 rounded px-2 py-0.5 ml-auto">
            Filtering ✕
          </span>
        )}
      </button>
      <div className="p-4 md:p-5">
        {skeleton.coreCards.length > 0 && (
          <div className="mb-5">
            <Text xs className="text-text-secondary font-semibold uppercase tracking-[0.16em] mb-2.5">
              Core (&gt;={coreThreshold}% of pools)
            </Text>
            <div className="flex flex-row flex-wrap gap-2">
              {skeleton.coreCards.map((card) => (
                <SkeletonCardImage key={card.oracle_id} card={card} size={SIM_PREVIEW_CARD_W} />
              ))}
            </div>
          </div>
        )}
        {skeleton.occasionalCards.length > 0 && (
          <div className="mb-4">
            <Text xs className="text-text-secondary/80 font-medium uppercase tracking-[0.14em] mb-1.5">
              Support ({Math.round(coreThreshold / 2)}-{coreThreshold - 1}% of pools)
            </Text>
            <div className="flex flex-row flex-wrap gap-1.5">
              {skeleton.occasionalCards.map((card) => (
                <SkeletonCardImage key={card.oracle_id} card={card} size={SIM_PREVIEW_CARD_W} />
              ))}
            </div>
          </div>
        )}
        {skeleton.sideboardCards.length > 0 && (
          <div className="mb-4">
            <Text xs className="text-text-secondary/80 font-medium uppercase tracking-[0.14em] mb-2">
              Common Sideboard Cards
            </Text>
            <div className="flex flex-col gap-1.5 rounded-md bg-bg-accent/40 px-3 py-2">
              {skeleton.sideboardCards.map((card) => (
                <div key={card.oracle_id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{renderAutocardNameLink(card.oracle_id, card.name)}</span>
                  <span className="text-text-secondary tabular-nums">{(card.fraction * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {skeleton.lockPairs.length > 0 && (
          <div className="pt-1">
            <Text xs className="text-text-secondary font-semibold uppercase tracking-[0.16em] mb-2">
              Lock Pairs
            </Text>
            <Flexbox direction="col" gap="1">
              {skeleton.lockPairs.map((pair) => (
                <div key={`${pair.oracle_id_a}-${pair.oracle_id_b}`} className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-yellow-500 text-black font-bold flex-shrink-0"
                    style={{ fontSize: 9 }}
                  >
                    !
                  </span>
                  <span className="font-medium">{pair.nameA}</span>
                  <span className="text-text-secondary">+</span>
                  <span className="font-medium">{pair.nameB}</span>
                  <span className="text-text-secondary ml-1">
                    {(pair.coOccurrenceRate * 100).toFixed(0)}% co-occurrence
                  </span>
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
            <Text xs className="text-text-secondary mt-0.5">
              Grouped by shared cards
            </Text>
          </button>
          <div className="flex flex-row items-center gap-2 flex-shrink-0">
            {isOpen && (
              <>
                <label className="text-xs font-medium text-text-secondary whitespace-nowrap">Clusters</label>
                <NumericInput min={2} max={16} value={k} onChange={onSetK} className="w-14" />
                <label className="text-xs font-medium text-text-secondary whitespace-nowrap">Core %</label>
                <NumericInput min={10} max={95} value={coreThreshold} onChange={onSetCoreThreshold} className="w-14" />
                <button
                  type="button"
                  onClick={handleRecluster}
                  className={[
                    'whitespace-nowrap px-2 py-1 rounded text-xs font-medium border transition-colors',
                    reclusterFlash
                      ? 'bg-green-700 text-white border-green-600'
                      : 'bg-bg-accent border-border hover:bg-bg-active',
                  ].join(' ')}
                >
                  {reclusterFlash ? '✓ Done' : 'Re-cluster'}
                </button>
              </>
            )}
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
                  {showAllClusters
                    ? 'Show fewer clusters'
                    : `Show ${hiddenSkeletons.length} more cluster${hiddenSkeletons.length === 1 ? '' : 's'}`}
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
  const [currentRunSetup, setCurrentRunSetup] = useState<
    Pick<SimulationSetupResponse, 'initialPacks' | 'packSteps' | 'numSeats'> | null
  >(null);
  const [selectedTs, setSelectedTs] = useState<number | null>(null);
  const [loadingRun, setLoadingRun] = useState(false);
  const [deleteRunModalOpen, setDeleteRunModalOpen] = useState(false);
  const [runPendingDelete, setRunPendingDelete] = useState<SimulationRunEntry | null>(null);
  const [clearHistoryModalOpen, setClearHistoryModalOpen] = useState(false);

  // Card pool view
  const [selectedCardOracles, setSelectedCardOracles] = useState<string[]>([]);
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [selectedSkeletonId, setSelectedSkeletonId] = useState<number | null>(null);
  const poolViewRef = useRef<HTMLDivElement>(null);
  const detailedViewRef = useRef<HTMLDivElement>(null);
  const cardStatsRef = useRef<HTMLDivElement>(null);
  const simAbortRef = useRef<AbortController | null>(null);

  // Section collapse state (default collapsed)
  const [archetypesOpen, setArchetypesOpen] = useState(true);
  const [deckColorOpen, setDeckColorOpen] = useState(true);
  const [cardStatsOpen, setCardStatsOpen] = useState(true);

  // Archetype skeleton clustering
  const [clusterK, setClusterK] = useState(10);
  const [clusterSeed, setClusterSeed] = useState(0);
  const [coreThreshold, setCoreThreshold] = useState(60);
  const [deckBuildsLoading, setDeckBuildsLoading] = useState(false);

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
      ...(cube.formats ?? []).map((format, index) => ({ value: `${index}`, label: format.title || `Format ${index + 1}` })),
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
    setStorageNotice(null);
  }, [cubeId]);

  const handleCancel = useCallback(() => {
    simAbortRef.current?.abort();
    simAbortRef.current = null;
    setStatus('idle');
    setSimPhase(null);
    setDeckBuildsLoading(false);
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
        const fallbackBatchSize = err instanceof WebGLInferenceError ? nextLowerGpuBatchSize(effectiveGpuBatchSize) : null;
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
      setDeckBuildsLoading(true);
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
        const fallbackBatchSize = err instanceof WebGLInferenceError ? nextLowerGpuBatchSize(effectiveGpuBatchSize) : null;
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
      setDeckBuildsLoading(false);
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
      setDeckBuildsLoading(false);
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
  useEffect(() => {
    if (!displayRunData || displayRunData.slimPools.length === 0) {
      setSkeletons([]);
      return;
    }
    // startTransition defers the k-means computation so user interactions aren't blocked
    React.startTransition(() => {
      setSkeletons(
        computeSkeletons(displayRunData.slimPools, displayRunData.cardMeta, clusterK, coreThreshold, activeDecks),
      );
    });
    // clusterSeed intentionally triggers re-cluster without being a real dependency
  }, [displayRunData, clusterK, clusterSeed, coreThreshold, activeDecks]);

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
  const scopedPools = useMemo(
    () => displayedPools.filter((p) => !activeFilterPoolIndexSet || activeFilterPoolIndexSet.has(p.poolIndex)),
    [displayedPools, activeFilterPoolIndexSet],
  );

  // Scroll to Detailed View whenever a new selection is made
  useEffect(() => {
    if (
      (selectedCardOracles.length > 0 || selectedArchetype || selectedSkeletonId !== null) &&
      detailedViewRef.current
    ) {
      detailedViewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedCardOracles, selectedArchetype, selectedSkeletonId]);

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (selectedSkeletonId !== null) {
      const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
      const skIdx = skeletons.indexOf(sk!);
      if (sk) chips.push(`Cluster: ${skIdx + 1}`);
    }
    if (selectedArchetype) chips.push(`Deck Color: ${archetypeFullName(selectedArchetype)}`);
    for (const selectedCardEntry of selectedCards) chips.push(`Decks Containing: ${selectedCardEntry.name}`);
    return chips;
  }, [selectedSkeletonId, selectedArchetype, selectedCards, skeletons]);

  const activeFilterSummary = useMemo(() => {
    if (activeFilterChips.length === 0) return null;
    return activeFilterChips.join(' · ');
  }, [activeFilterChips]);

  const selectedArchetypePreview = useMemo(() => {
    if (!displayRunData || !selectedArchetype) return null;
    const isBasicLand = (oracleId: string) => {
      const typeLower = (displayRunData.cardMeta[oracleId]?.type ?? '').toLowerCase();
      return typeLower.includes('basic land');
    };

    const matchingPoolIndices = scopedPools
      .filter((pool) => pool.archetype === selectedArchetype)
      .map((pool) => pool.poolIndex);
    if (matchingPoolIndices.length === 0) return null;

    const mainboardCounts = new Map<string, number>();
    const sideboardOnlyCounts = new Map<string, number>();
    const hasDeckData = !!activeDecks && activeDecks.length === displayedPools.length;

    for (const poolIndex of matchingPoolIndices) {
      if (hasDeckData) {
        const deck = activeDecks?.[poolIndex];
        if (!deck) continue;
        for (const oracleId of new Set(deck.mainboard)) {
          if (!oracleId || isBasicLand(oracleId)) continue;
          mainboardCounts.set(oracleId, (mainboardCounts.get(oracleId) ?? 0) + 1);
        }
        for (const oracleId of new Set(deck.sideboard)) {
          if (!oracleId || isBasicLand(oracleId)) continue;
          if (!deck.mainboard.includes(oracleId)) {
            sideboardOnlyCounts.set(oracleId, (sideboardOnlyCounts.get(oracleId) ?? 0) + 1);
          }
        }
      } else {
        const pool = displayedPools[poolIndex];
        if (!pool) continue;
        for (const oracleId of new Set(pool.picks.map((pick) => pick.oracle_id))) {
          if (!oracleId || isBasicLand(oracleId)) continue;
          mainboardCounts.set(oracleId, (mainboardCounts.get(oracleId) ?? 0) + 1);
        }
      }
    }

    const toSkeletonCard = ([oracleId, count]: [string, number]): SkeletonCard => ({
      oracle_id: oracleId,
      name: displayRunData.cardMeta[oracleId]?.name || oracleId,
      imageUrl: displayRunData.cardMeta[oracleId]?.imageUrl ?? '',
      fraction: count / matchingPoolIndices.length,
    });

    const commonCards = [...mainboardCounts.entries()]
      .map(toSkeletonCard)
      .sort((a, b) => b.fraction - a.fraction)
      .slice(0, 8);

    const supportCards = [...mainboardCounts.entries()]
      .map(toSkeletonCard)
      .sort((a, b) => b.fraction - a.fraction)
      .slice(8, 16);

    const sideboardCards = [...sideboardOnlyCounts.entries()]
      .map(toSkeletonCard)
      .filter((card) => card.fraction >= 0.15)
      .sort((a, b) => b.fraction - a.fraction)
      .slice(0, 5);

    return { commonCards, supportCards, sideboardCards };
  }, [displayRunData, selectedArchetype, scopedPools, activeDecks, displayedPools]);

  const detailedViewScopeChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    for (const selectedCardEntry of selectedCards) {
      chips.push({
        key: `card-${selectedCardEntry.oracle_id}`,
        label: selectedCardEntry.name,
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
          onClear: () => setSelectedSkeletonId(null),
        });
      }
    }
    if (selectedArchetype) {
      chips.push({
        key: `archetype-${selectedArchetype}`,
        label: archetypeFullName(selectedArchetype),
        onClear: () => setSelectedArchetype(null),
      });
    }
    return chips;
  }, [selectedCards, selectedSkeletonId, selectedArchetype, skeletons]);

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
    return 'Detailed View';
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
                  <div className="simSectionHeading">
                    <Text semibold className="tracking-wide">
                      Overview
                    </Text>
                  </div>
                  <Flexbox direction="col" gap="4">
                    <Flexbox direction="row" gap="4" className="flex-wrap">
                      <SummaryCard
                        label="Drafts Simulated"
                        value={displayRunData.numDrafts}
                        sub={`${displayRunData.numSeats} seats each`}
                      />
                      <SummaryCard
                        label="Dead Cards"
                        value={displayRunData.deadCards.length}
                        sub={`< ${(displayRunData.deadCardThreshold * 100).toFixed(0)}% pick rate`}
                        onClick={() => {
                          setCardStatsOpen(true);
                          setTimeout(
                            () => cardStatsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                            50,
                          );
                        }}
                        badge={
                          displayRunData.deadCards.length > 0 ? (
                            <span className="text-xs text-link">Click to view in card stats</span>
                          ) : undefined
                        }
                      />
                      <SummaryCard
                        label="Cards Tracked"
                        value={displayRunData.cardStats.length}
                        sub="unique cards seen across all packs"
                      />
                      {displayRunData.timings && (
                        <SummaryCard
                          label="Run Time"
                          value={formatDuration(displayRunData.timings.totalMs)}
                          sub="end-to-end in this browser"
                        />
                      )}
                    </Flexbox>
                    {displayRunData.timings && (
                      <Card className="border-border/60 bg-bg-accent/20">
                        <CardBody>
                          <Flexbox direction="row" gap="3" className="flex-wrap">
                            <Text xs className="text-text-secondary">
                              Setup: <span className="text-text">{formatDuration(displayRunData.timings.setupMs)}</span>
                            </Text>
                            <Text xs className="text-text-secondary">
                              Model load:{' '}
                              <span className="text-text">{formatDuration(displayRunData.timings.modelLoadMs)}</span>
                            </Text>
                            <Text xs className="text-text-secondary">
                              Draft sim:{' '}
                              <span className="text-text">{formatDuration(displayRunData.timings.simulationMs)}</span>
                            </Text>
                            <Text xs className="text-text-secondary">
                              Deckbuild:{' '}
                              <span className="text-text">{formatDuration(displayRunData.timings.deckbuildMs)}</span>
                            </Text>
                            <Text xs className="text-text-secondary">
                              Save: <span className="text-text">{formatDuration(displayRunData.timings.saveMs)}</span>
                            </Text>
                          </Flexbox>
                        </CardBody>
                      </Card>
                    )}
                  </Flexbox>
                </div>
                <div className="simSection simSectionCards flex flex-col gap-5 pt-2">
                  <div className="simSectionHeading">
                    <Text semibold className="tracking-wide">
                      Card Analysis
                    </Text>
                  </div>
                  <Flexbox direction="col" gap="4">
                    <div className="simCardDiagBlock simCardDiagSummary flex flex-col gap-4">
                      <div className="simCardDiagBlock simCardDiagElo">
                        <Card>
                          <CardHeader>
                            <div>
                              <div>
                                <Text semibold>Elo vs. Pick Position</Text>
                              </div>
                              <div className="mt-0.5">
                                <Text xs className="text-text-secondary">
                                  Each dot is a card. Higher on the chart means it is taken earlier on average.
                                </Text>
                              </div>
                            </div>
                          </CardHeader>
                          <CardBody>
                            <EloVsPickRateScatter cardStats={displayRunData.cardStats} />
                          </CardBody>
                        </Card>
                      </div>
                      <div className="simCardDiagBlock simCardDiagContext">
                        <DraftVsEloTable cardStats={displayRunData.cardStats} />
                      </div>
                    </div>
                    <div className="simSection simSectionArchetypes flex flex-col gap-5 pt-2">
                      <div className="simSectionHeading">
                        <Text semibold className="tracking-wide">
                          Draft Patterns
                        </Text>
                      </div>
                      <Row className="gap-4">
                        <Col xs={12}>
                          <Card>
                            <CardHeader>
                              <Flexbox
                                direction="row"
                                justify="between"
                                alignItems="center"
                                className="flex-wrap gap-2"
                              >
                                <div>
                                  <div>
                                    <Text semibold>Deck Color Distribution</Text>
                                  </div>
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
                          onSelectSkeleton={(id) => {
                            setSelectedSkeletonId(id);
                            setSelectedArchetype(null);
                          }}
                          isOpen={archetypesOpen}
                          onToggle={() => setArchetypesOpen((o) => !o)}
                        />
                      )}
                    </div>
                    <div
                      ref={detailedViewRef}
                      className="simCardDiagBlock simCardDiagDetailArea flex flex-col gap-5 pt-2"
                    >
                      <div className="simSectionHeading">
                        <Text semibold className="tracking-wide">
                          Detailed View
                        </Text>
                      </div>
                      {/* Top summary row — no harsh inner borders, flat surfaces */}
                      <div className="flex flex-col md:flex-row gap-3 items-stretch">
                        {/* Left: selected card / default state */}
                        <div className="flex-1 min-w-0 rounded-lg bg-bg-accent/40 px-4 py-3">
                          {selectedCards.length > 0 ? (
                            <Flexbox direction="row" gap="3" alignItems="start" className="min-w-0">
                              <div className="flex flex-row gap-2 flex-shrink-0">
                                {selectedCards.map((card) => {
                                  const imageUrl = displayRunData.cardMeta[card.oracle_id]?.imageUrl;
                                  return imageUrl ? (
                                    <LinkedCardImage
                                      key={card.oracle_id}
                                      oracleId={card.oracle_id}
                                      name={card.name}
                                      imageUrl={imageUrl}
                                      size={SIM_PREVIEW_CARD_W}
                                    />
                                  ) : null;
                                })}
                              </div>
                              <div className="min-w-0 flex-1">
                                <Text semibold className="text-lg leading-snug">
                                  {detailedViewTitle}
                                </Text>
                                <div className="mt-0.5">
                                  <Text xs className="text-text-secondary/60">
                                    {detailedViewSubtitle}
                                  </Text>
                                </div>
                                {selectedCard && (
                                  <Flexbox direction="row" gap="4" alignItems="center" className="flex-wrap mt-2">
                                    {(() => {
                                      // When a filter is active, use only filtered stats (null → card not seen in scope)
                                      const statsForScope = activeFilterPoolIndexSet
                                        ? selectedCardStats
                                        : (selectedCardStats ?? selectedCard);
                                      return (
                                        <>
                                          <span className="text-xs text-text-secondary/50 font-medium">
                                            Pick rate{' '}
                                            <span className="text-text-secondary/80">
                                              {statsForScope ? `${(statsForScope.pickRate * 100).toFixed(1)}%` : '0%'}
                                            </span>
                                          </span>
                                          <span className="text-xs text-text-secondary/50 font-medium">
                                            Avg position{' '}
                                            <span className="text-text-secondary/80">
                                              {statsForScope && statsForScope.avgPickPosition > 0
                                                ? statsForScope.avgPickPosition.toFixed(1)
                                                : '—'}
                                            </span>
                                          </span>
                                        </>
                                      );
                                    })()}
                                  </Flexbox>
                                )}
                              </div>
                            </Flexbox>
                          ) : (
                            <div>
                              <Text semibold className="text-lg leading-snug">
                                {detailedViewTitle}
                              </Text>
                              <div className="mt-0.5">
                                <Text xs className="text-text-secondary/60">
                                  {detailedViewSubtitle}
                                </Text>
                              </div>
                            </div>
                          )}
                        </div>
                        {/* Right: scope panel — only when filters active */}
                        {activeFilterChips.length > 0 && (
                          <div className="md:w-56 min-w-0 flex-shrink-0 rounded-lg bg-bg-accent/25 px-4 py-3">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className="text-xs font-medium text-text-secondary/60 uppercase tracking-wider">
                                Scope
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {detailedViewScopeChips.map((chip) => (
                                <button
                                  key={chip.key}
                                  type="button"
                                  className="inline-flex items-center gap-1 text-xs bg-bg-accent text-text-secondary/80 rounded px-2 py-0.5 hover:bg-bg-active"
                                  onClick={chip.onClear}
                                  title={`Clear ${chip.label} filter`}
                                  aria-label={`Clear ${chip.label} filter`}
                                >
                                  <span>{chip.label}</span>
                                  <span className="text-text-secondary/60">✕</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
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
                            Exact card-stat filtering requires pack sequence data that wasn't stored for this run. Deck
                            and draft breakdowns are filtered correctly; card-level stats approximate the full run.
                          </Text>
                        </div>
                      )}
                      {/* Cluster card preview — shown whenever a cluster is selected */}
                      {selectedSkeletonId !== null &&
                        (() => {
                          const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
                          if (
                            !sk ||
                            (sk.coreCards.length === 0 &&
                              sk.occasionalCards.length === 0 &&
                              sk.sideboardCards.length === 0)
                          )
                            return null;
                          return (
                            <div className="rounded-lg bg-bg-accent/30 border border-border/50 px-4 py-3">
                              <Text xs className="text-text-secondary font-semibold uppercase tracking-[0.14em] mb-2.5">
                                Cluster defining cards
                              </Text>
                              <div className="overflow-x-auto">
                                <div className="flex flex-row gap-2 pb-1" style={{ minWidth: 'max-content' }}>
                                  {sk.coreCards.map((card) => (
                                    <SkeletonCardImage key={card.oracle_id} card={card} size={90} />
                                    
                                  ))}
                                  {sk.occasionalCards.length > 0 && (
                                    <>
                                      <div className="w-px bg-border/60 self-stretch mx-1 flex-shrink-0" />
                                      {sk.occasionalCards.map((card) => (
                                        <div key={card.oracle_id}>
                                          <SkeletonCardImage card={card} size={SIM_PREVIEW_CARD_W} />
                                        </div>
                                      ))}
                                    </>
                                  )}
                                </div>
                              </div>
                              {sk.sideboardCards.length > 0 && (
                                <div className="pt-4 mt-3 border-t border-border/60">
                                  <Text
                                    xs
                                    className="text-text-secondary/70 font-medium uppercase tracking-[0.14em] mb-2"
                                  >
                                    Common Sideboard Cards for the Cluster
                                  </Text>
                                  <div className="flex flex-col gap-1.5 rounded-md bg-bg/60 px-3 py-2">
                                    {sk.sideboardCards.map((card) => (
                                    <div
                                        key={card.oracle_id}
                                        className="flex items-baseline justify-between gap-3 text-sm"
                                      >
                                        <span className="font-medium">
                                          {renderAutocardNameLink(card.oracle_id, card.name)}
                                        </span>
                                        <span className="text-text-secondary tabular-nums">
                                          {(card.fraction * 100).toFixed(0)}%
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      {selectedArchetype && selectedArchetypePreview && !selectedSkeletonId && (
                        <div className="rounded-lg bg-bg-accent/30 border border-border/50 px-4 py-3">
                          <div className="mb-2.5">
                            <Text xs className="text-text-secondary font-semibold uppercase tracking-[0.14em]">
                              Most common cards in {archetypeFullName(selectedArchetype)}
                            </Text>
                          </div>
                          <Text xs className="text-text-secondary/70 font-medium uppercase tracking-[0.14em] mb-2">
                            Most Common Main Deck Cards
                          </Text>
                          <div className="overflow-x-auto">
                            <div className="flex flex-row gap-2 pb-3" style={{ minWidth: 'max-content' }}>
                              {selectedArchetypePreview.commonCards.map((card) => (
                                <SkeletonCardImage key={card.oracle_id} card={card} size={SIM_PREVIEW_CARD_W} />
                              ))}
                              {selectedArchetypePreview.supportCards.length > 0 && (
                                <>
                                  <div className="w-px bg-border/60 self-stretch mx-1 flex-shrink-0" />
                                  {selectedArchetypePreview.supportCards.map((card) => (
                                    <div key={card.oracle_id}>
                                      <SkeletonCardImage card={card} size={SIM_PREVIEW_CARD_W} />
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          </div>
                          {selectedArchetypePreview.sideboardCards.length > 0 && (
                            <div className="pt-4 mt-1 border-t border-border/60">
                              <Text xs className="text-text-secondary/70 font-medium uppercase tracking-[0.14em] mb-2">
                                Most Common Sideboard Cards
                              </Text>
                              <div className="flex flex-col gap-1.5 rounded-md bg-bg/60 px-3 py-2">
                                {selectedArchetypePreview.sideboardCards.map((card) => (
                                  <div
                                    key={card.oracle_id}
                                    className="flex items-baseline justify-between gap-3 text-sm"
                                  >
                                    <span className="font-medium">
                                      {renderAutocardNameLink(card.oracle_id, card.name)}
                                    </span>
                                    <span className="text-text-secondary tabular-nums">
                                      {(card.fraction * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Mini chart row — lighter surface than the stats table below */}
                      <Row className="gap-3">
                        <Col xs={12} md={6}>
                          <Card className="border-border/50 bg-bg-accent/30">
                            <CardHeader>
                              <div>
                                <div>
                                  <Text semibold>Deck Color Share</Text>
                                </div>
                                <div className="mt-0.5">
                                  <Text xs className="text-text-secondary">
                                    Each main deck card contributes to its colors. Multicolor cards split evenly.
                                    {activeFilterPoolIndexSet ? ' Filtered to current scope.' : ''}
                                  </Text>
                                </div>
                              </div>
                            </CardHeader>
                            <CardBody>
                              <DeckColorShareChart deckBuilds={filteredDecks} cardMeta={displayRunData.cardMeta} />
                            </CardBody>
                          </Card>
                        </Col>
                        <Col xs={12} md={6}>
                          <Card className="border-border/50 bg-bg-accent/30">
                            <CardHeader>
                              <div>
                                <div>
                                  <Text semibold>Mana Curve Share</Text>
                                </div>
                                <div className="mt-0.5">
                                  <Text xs className="text-text-secondary">
                                    Nonland main deck cards by mana value.
                                    {activeFilterPoolIndexSet ? ' Filtered to current scope.' : ''}
                                  </Text>
                                </div>
                              </div>
                            </CardHeader>
                            <CardBody>
                              <ManaCurveShareChart deckBuilds={filteredDecks} cardMeta={displayRunData.cardMeta} />
                            </CardBody>
                          </Card>
                        </Col>
                      </Row>
                      <div ref={cardStatsRef} className="simCardDiagBlock simCardDiagTable flex flex-col gap-5">
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
                              <CardStatsTable
                                cardStats={visibleCardStats}
                                deadCardThreshold={displayRunData.deadCardThreshold}
                                onSelectCard={handleToggleSelectedCard}
                                selectedCardOracles={selectedCardOracles}
                                inDeckOracles={inDeckOracles}
                                inSideboardOracles={inSideboardOracles}
                                deckInclusionPct={deckInclusionPct}
                                visiblePoolCounts={visiblePoolCounts}
                                onPageChange={() =>
                                  detailedViewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                }
                              />
                            </CardBody>
                          </Collapse>
                        </Card>
                        {selectedCard && (
                          <div
                            ref={poolViewRef}
                            className="simCardDiagBlock simCardDiagDetail pt-2 border-t border-border"
                          >
                            <CardPoolView
                              card={selectedCard}
                              pools={selectedPools}
                              deckBuilds={activeDecks}
                              deckLoading={deckBuildsLoading}
                              cardMeta={displayRunData.cardMeta}
                              runData={displayRunData}
                              onClose={() => setSelectedCardOracles([])}
                            />
                          </div>
                        )}
                      </div>
                      {selectedCards.length > 1 && (
                        <div ref={poolViewRef}>
                          <ArchetypePoolList
                            archetype={selectedArchetype ?? ''}
                            title={detailedViewTitle}
                            pools={selectedPools}
                            deckBuilds={activeDecks}
                            deckLoading={deckBuildsLoading}
                            cardMeta={displayRunData.cardMeta}
                            runData={displayRunData}
                            onClose={() => setSelectedCardOracles([])}
                          />
                        </div>
                      )}
                      {(selectedSkeletonId !== null || selectedArchetype) &&
                        !selectedCard &&
                        selectedCards.length <= 1 && (
                          <div ref={poolViewRef}>
                            {selectedSkeletonId !== null &&
                              !selectedArchetype &&
                              (() => {
                                const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
                                const skIdx = skeletons.indexOf(sk!);
                                return sk ? (
                                  <ArchetypePoolList
                                    archetype={sk.colorProfile}
                                    title={`Cluster ${skIdx + 1}`}
                                    pools={scopedPools}
                                    deckBuilds={activeDecks}
                                    deckLoading={deckBuildsLoading}
                                    cardMeta={displayRunData.cardMeta}
                                    runData={displayRunData}
                                    onClose={() => setSelectedSkeletonId(null)}
                                  />
                                ) : null;
                              })()}
                            {selectedArchetype && !selectedSkeletonId && (
                              <ArchetypePoolList
                                archetype={selectedArchetype}
                                title={activeFilterSummary ?? archetypeFullName(selectedArchetype)}
                                pools={scopedPools}
                                deckBuilds={activeDecks}
                                deckLoading={deckBuildsLoading}
                                cardMeta={displayRunData.cardMeta}
                                runData={displayRunData}
                                onClose={() => setSelectedArchetype(null)}
                              />
                            )}
                          </div>
                        )}
                    </div>
                  </Flexbox>
                </div>
                <Text xs className="text-text-secondary text-right">
                  Generated {new Date(displayRunData.generatedAt).toLocaleString()}
                </Text>
              </Flexbox>
            )}

            <div className="simSection simSectionReference flex flex-col gap-4 pt-3 border-t border-border">
              <div className="simSectionHeading simSectionHeadingSubtle">
                <Text semibold className="tracking-wide text-text-secondary">
                  Reference
                </Text>
              </div>
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
          Pack generation still starts on the server, because CubeCobra needs the cube, the draft format, and the
          exact initial seat/pack layout. After that setup payload arrives, the expensive simulation work runs in the
          browser.
        </p>
        <p>
          The draft model and deckbuilder are loaded through TensorFlow.js and executed on the client with the browser
          GPU path. In practice that means your machine does the pick-by-pick inference and deckbuilding locally
          instead of sending every draft step back to the backend.
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
          archetype. Clustering on main decks instead of full pools keeps the focus on cards that actually made the
          final deck, rather than sideboard picks. Three steps build the vectors used for comparison:
        </p>
        <ol className="list-decimal list-inside space-y-1.5 ml-2">
          <li>
            <span className="font-medium text-text">Binary presence</span> — each main deck becomes a vector of 1s (in
            the deck) and 0s (not in the deck), one dimension per card.
          </li>
          <li>
            <span className="font-medium text-text">TF-IDF weighting</span> — cards that show up in nearly every deck
            get low weight, while cards that help distinguish one deck family from another get higher weight. Formally:{' '}
            <code className="text-xs bg-bg-accent px-1 py-0.5 rounded">
              weight = log((N+1) / (poolsContainingCard+1))
            </code>
            . This stops universal staples from dominating the grouping.
          </li>
          <li>
            <span className="font-medium text-text">L2 normalisation</span> — each vector is scaled to unit length so
            clustering is driven more by card composition than raw vector magnitude.
          </li>
        </ol>
        <p>
          K-means++ then assigns decks to K clusters. Raising K splits broad families into narrower ones; lowering K
          merges similar families together. Re-cluster reruns the same process with a different random seed, which is
          useful when a few decks sit near the boundary between groups.
        </p>
        <p>Each cluster shows:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>
            <span className="font-medium text-text">Core cards</span> — cards found in at least Core% of decks in the
            cluster
          </li>
          <li>
            <span className="font-medium text-text">Support cards</span> — cards found in roughly half Core% up to Core%
            of decks in the cluster
          </li>
          <li>
            <span className="font-medium text-text">Common sideboard cards</span> — cards that show up in sideboards for
            a meaningful share of decks in the cluster without commonly making the main deck
          </li>
          <li>
            <span className="font-medium text-text">Lock pairs</span> — card pairs that appear together much more often
            than their individual rates would predict (&gt;60% co-occurrence and &gt;5% above the independence
            baseline). These often signal tight synergies or linear plans.
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
          builds that included a card in the pool chose to put it in the main deck — near 100% means it's an auto-include whenever
          drafted; low values indicate it frequently gets relegated to the sideboard.
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
