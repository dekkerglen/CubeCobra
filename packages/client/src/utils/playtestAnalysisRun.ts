// Orchestrates a single client-side playtest-analysis run. Mirrors the record
// analysis flow (recordAnalysisRun.ts): fetch every human draft's raw pick data,
// aggregate per-card draft stats in the browser, then load the ML model and
// cluster the decks into archetypes (encode → k-NN + Leiden + UMAP).
//
// Unlike the record analysis (which measures match win rates) this looks only at
// how humans drafted: pick rates, wheels, first-pick behavior and the shape of the
// decks they built. Most playtest drafts are 1 human vs 7 bots, so exactly one
// human deck is taken from each draft (chosen server-side).

import Card from '@utils/datatypes/Card';
import type Cube from '@utils/datatypes/Cube';
import type { BuiltDeck, CardMeta, CardStats, SlimPool } from '@utils/datatypes/SimulationReport';

import { buildOracleRemapping, encodePools, loadDraftBot, reshapeEmbeddings } from './draftBot';
import {
  assignArchetypeLabels,
  CLUSTER_NEG_SAMPLES,
  computeSkeletons,
  KNN_K_DIVISOR,
  LEIDEN_RES_DIVISOR,
  loadArchetypeData,
} from './draftSimulatorClustering';
import { PlaytestAnalysisRunData, PlaytestDeck, PlaytestPick, RecordCardInfo } from './playtestAnalysisStorage';
import { buildCardMeta } from './recordCardMeta';

type CsrfFetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>;

export type RunPhase = 'setup' | 'loadmodel' | 'cluster' | 'save';

interface RawPlaytestDraft {
  id: string;
  date: number;
  seats: number;
  picks: PlaytestPick[];
  mainboard: number[];
  sideboard: number[];
}

// A deck's color identity: colors on >10% of its non-land cards. (Same rule the
// record analysis uses, so color labels line up across the two dashboards.)
const assessDeckColors = (oracles: string[], cardMeta: Record<string, CardMeta>): string[] => {
  const counts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  let n = 0;
  for (const o of oracles) {
    const m = cardMeta[o];
    if (!m || (m.type ?? '').toLowerCase().includes('land')) continue;
    n += 1;
    for (const c of m.colorIdentity ?? []) if (Object.prototype.hasOwnProperty.call(counts, c)) counts[c] += 1;
  }
  if (n === 0) return [];
  return (['W', 'U', 'B', 'R', 'G'] as const).filter((c) => counts[c]! / n > 0.1);
};

interface RawStats {
  timesSeen: number;
  timesPicked: number;
  pickPositionSum: number;
  pickPositionCount: number;
  wheelCount: number;
  p1p1Count: number;
  p1p1Seen: number;
  pxp1Count: number;
  pxp1Seen: number;
  poolIndices: number[];
  p1p1PoolIndices: number[];
}

const emptyRawStats = (): RawStats => ({
  timesSeen: 0,
  timesPicked: 0,
  pickPositionSum: 0,
  pickPositionCount: 0,
  wheelCount: 0,
  p1p1Count: 0,
  p1p1Seen: 0,
  pxp1Count: 0,
  pxp1Seen: 0,
  poolIndices: [],
  p1p1PoolIndices: [],
});

/**
 * Aggregate per-card draft stats over a subset of the analyzed decks. Passing the
 * full pool set gives the global table; passing one archetype cluster's pools
 * re-scopes every column to that archetype. Mirrors the draft simulator's
 * computeFilteredCardStats, but reads the reconstructed pick data captured per run.
 */
export function computePlaytestCardStats(
  perPick: PlaytestPick[][],
  seatsByPool: number[],
  oracles: string[],
  cardMeta: Record<string, CardMeta>,
  activePoolIndexSet: Set<number>,
): CardStats[] {
  const statsMap = new Map<number, RawStats>();
  const get = (o: number): RawStats => {
    let s = statsMap.get(o);
    if (!s) {
      s = emptyRawStats();
      statsMap.set(o, s);
    }
    return s;
  };

  for (const poolIndex of activePoolIndexSet) {
    const picks = perPick[poolIndex];
    if (!picks) continue;
    const seats = seatsByPool[poolIndex] ?? 8;
    for (const pick of picks) {
      const isP1P1 = pick.pk === 0 && pick.pip === 1;
      const isPxP1 = pick.pip === 1;
      for (const seen of pick.seen) {
        const s = get(seen);
        s.timesSeen++;
        if (isP1P1) s.p1p1Seen++;
        if (isPxP1) s.pxp1Seen++;
      }
      const picked = get(pick.o);
      picked.timesPicked++;
      picked.pickPositionSum += pick.pip;
      picked.pickPositionCount++;
      if (pick.pip > seats) picked.wheelCount++;
      if (isP1P1) {
        picked.p1p1Count++;
        picked.p1p1PoolIndices.push(poolIndex);
      }
      if (isPxP1) picked.pxp1Count++;
      picked.poolIndices.push(poolIndex);
    }
  }

  const out: CardStats[] = [];
  for (const [o, s] of statsMap) {
    if (s.timesSeen === 0) continue;
    const oracle = oracles[o]!;
    const meta = cardMeta[oracle];
    out.push({
      oracle_id: oracle,
      name: meta?.name ?? oracle,
      colorIdentity: meta?.colorIdentity ?? [],
      elo: meta?.elo ?? 1200,
      timesSeen: s.timesSeen,
      timesPicked: s.timesPicked,
      pickRate: s.timesSeen > 0 ? s.timesPicked / s.timesSeen : 0,
      avgPickPosition: s.pickPositionCount > 0 ? s.pickPositionSum / s.pickPositionCount : 0,
      wheelCount: s.wheelCount,
      p1p1Count: s.p1p1Count,
      p1p1Seen: s.p1p1Seen,
      pxp1Count: s.pxp1Count,
      pxp1Seen: s.pxp1Seen,
      poolIndices: s.poolIndices,
      p1p1PoolIndices: s.p1p1PoolIndices,
    });
  }
  return out;
}

export async function runPlaytestAnalysis(
  csrfFetch: CsrfFetch,
  cube: Cube,
  cubeCards: Card[],
  callbacks: { onPhase: (p: RunPhase) => void; onModelProgress: (pct: number) => void; signal?: AbortSignal },
): Promise<PlaytestAnalysisRunData> {
  const { onPhase, onModelProgress, signal } = callbacks;
  const throwIfAborted = () => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  };

  // ── Fetch raw inputs ───────────────────────────────────────────────────────
  onPhase('setup');
  const res = await csrfFetch(`/cube/analysis/playtestdata/${encodeURIComponent(cube.id)}`, { method: 'GET' });
  const json = await res.json();
  if (!json?.success || !Array.isArray(json.drafts) || !Array.isArray(json.oracles)) {
    throw new Error('Failed to load playtest data');
  }
  const oracles: string[] = json.oracles;
  const cardImages: { [oracle: string]: RecordCardInfo } = json.cards ?? {};
  const rawDrafts: RawPlaytestDraft[] = json.drafts;
  const capped: boolean = !!json.capped;
  throwIfAborted();

  // ── Build per-deck data ─────────────────────────────────────────────────────
  // Card metadata for color assessment (cube cards, backfilled with captured info
  // for cards no longer in the live cube so their colors still count).
  const colorMeta = buildCardMeta(cubeCards);
  for (const [oracle, info] of Object.entries(cardImages)) {
    if (!colorMeta[oracle]) {
      colorMeta[oracle] = {
        name: info.name,
        imageUrl: info.imageUrl,
        colorIdentity: info.colorIdentity,
        elo: 1200,
        cmc: info.cmc,
        type: info.type,
        producedMana: [],
      };
    }
  }

  const perPick: PlaytestPick[][] = [];
  const seatsByPool: number[] = [];
  const decks: PlaytestDeck[] = [];
  let pickCount = 0;

  for (const draft of rawDrafts) {
    const mainboard = draft.mainboard.map((i) => oracles[i]).filter((o): o is string => !!o);
    const sideboard = draft.sideboard.map((i) => oracles[i]).filter((o): o is string => !!o);
    perPick.push(draft.picks);
    seatsByPool.push(draft.seats);
    pickCount += draft.picks.length;
    decks.push({
      draftId: draft.id,
      date: draft.date,
      seats: draft.seats,
      mainboard,
      sideboard,
      clusterId: null,
      x: 0,
      y: 0,
      colors: assessDeckColors(mainboard, colorMeta),
      archetype: '',
    });
  }
  throwIfAborted();

  // ── Cluster decks into archetypes (ML model) ───────────────────────────────
  let skeletons: PlaytestAnalysisRunData['skeletons'] = [];
  let clusterMethod = '';
  let clustered = false;

  if (decks.length >= 3) {
    try {
      onPhase('loadmodel');
      await loadDraftBot(onModelProgress);
      throwIfAborted();

      onPhase('cluster');
      let remapping: Record<string, string> = {};
      try {
        const r = await csrfFetch('/tool/api/mlsubstitutions', { method: 'GET' });
        const rj = await r.json();
        remapping = rj?.remapping ?? {};
      } catch {
        remapping = {};
      }
      const cardMeta = buildCardMeta(cubeCards, remapping);

      const oracleRemapping = buildOracleRemapping(cardMeta);
      const pools = decks.map((deck) => deck.mainboard);
      const flat = await encodePools(pools, oracleRemapping);
      const embeddings = reshapeEmbeddings(flat, pools.length);
      throwIfAborted();

      const slimPools: SlimPool[] = decks.map((deck, i) => ({
        draftIndex: 0,
        seatIndex: i,
        archetype: '',
        picks: deck.mainboard.map((oracle, p) => ({ oracle_id: oracle, packNumber: 0, pickNumber: p + 1 })),
      }));
      const deckBuilds: BuiltDeck[] = decks.map((deck) => ({ mainboard: deck.mainboard, sideboard: deck.sideboard }));
      const n = decks.length;
      const knnK = Math.min(50, Math.max(5, Math.round(n / KNN_K_DIVISOR)));
      const resolution = parseFloat(Math.min(2.0, Math.max(0.5, n / LEIDEN_RES_DIVISOR)).toFixed(2));

      const result = computeSkeletons(
        slimPools,
        cardMeta,
        embeddings,
        deckBuilds,
        knnK,
        CLUSTER_NEG_SAMPLES,
        resolution,
      );
      skeletons = result.skeletons;
      clusterMethod = result.clusterMethod;

      let archetypeLabels: Map<number, string> | null = null;
      try {
        const archetypeData = await loadArchetypeData();
        if (archetypeData) archetypeLabels = assignArchetypeLabels(embeddings, archetypeData);
      } catch {
        archetypeLabels = null;
      }

      for (let i = 0; i < decks.length; i++) {
        decks[i]!.x = result.umapCoords[i]?.x ?? 0;
        decks[i]!.y = result.umapCoords[i]?.y ?? 0;
        decks[i]!.archetype = archetypeLabels?.get(i) ?? '';
      }
      for (const skel of result.skeletons) {
        for (const idx of skel.poolIndices) {
          if (decks[idx]) decks[idx]!.clusterId = skel.clusterId;
        }
      }
      clustered = true;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      // Clustering is best-effort: keep the aggregate stats even if the model or
      // encoding fails, just without the archetype map.

      console.error('Playtest-analysis clustering failed', err);
    }
  }

  onPhase('save');
  return {
    ts: Date.now(),
    generatedAt: new Date().toISOString(),
    draftCount: decks.length,
    pickCount,
    capped,
    oracles,
    perPick,
    decks,
    skeletons,
    clusterMethod,
    clustered,
    cardImages,
  };
}
