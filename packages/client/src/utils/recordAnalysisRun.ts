// Orchestrates a single client-side record-analysis run, mirroring the draft
// simulator's run flow: fetch raw inputs, aggregate everything in the browser
// (per-card stats, synergies, matchups, Match Elo), then load the ML model and
// cluster the decks into archetypes (encode → k-NN + Leiden + UMAP).

import Card from '@utils/datatypes/Card';
import type Cube from '@utils/datatypes/Cube';
import { Analytic, MatchupStat, PlayerAnalytic } from '@utils/datatypes/RecordAnalytic';
import type { CardMeta, SlimPool } from '@utils/datatypes/SimulationReport';

import { buildOracleRemapping, encodePools, loadDraftBot, reshapeEmbeddings } from './draftBot';
import {
  assignArchetypeLabels,
  CLUSTER_NEG_SAMPLES,
  computeSkeletons,
  KNN_K_DIVISOR,
  LEIDEN_RES_DIVISOR,
  loadArchetypeData,
} from './draftSimulatorClustering';
import {
  AnalysisDeck,
  ClusterMatchups,
  ColorMatchups,
  RecordAnalysisRunData,
  RecordCardInfo,
} from './recordAnalysisStorage';
import { buildCardMeta } from './recordCardMeta';

type CsrfFetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>;

export type RunPhase = 'setup' | 'loadmodel' | 'cluster' | 'save';

interface RawRecord {
  id: string;
  name: string;
  date: number;
  players: { name: string; userId?: string }[];
  matches: { matches: { p1: string; p2: string; results: number[] }[] }[];
  trophy: string[];
  decks: { [playerName: string]: string[] };
}

interface Standing {
  name: string;
  id?: string;
  matchWins: number;
  matchLosses: number;
  matchDraws: number;
  gameWins: number;
  gameLosses: number;
  gameDraws: number;
  trophy: boolean;
}

const emptyAnalytic = (): Analytic => ({
  decks: 0,
  trophies: 0,
  matchWins: 0,
  matchLosses: 0,
  matchDraws: 0,
  gameWins: 0,
  gameLosses: 0,
  gameDraws: 0,
});

const addStanding = (map: { [key: string]: Analytic }, key: string, s: Standing): void => {
  const e = (map[key] ??= emptyAnalytic());
  e.decks += 1;
  if (s.trophy) e.trophies += 1;
  e.matchWins += s.matchWins;
  e.matchLosses += s.matchLosses;
  e.matchDraws += s.matchDraws;
  e.gameWins += s.gameWins;
  e.gameLosses += s.gameLosses;
  e.gameDraws += s.gameDraws;
};

const addMatchup = (map: { [key: string]: MatchupStat }, x: string, y: string, d: MatchupStat): void => {
  const e = (map[`${x}|${y}`] ??= {
    matches: 0,
    matchWins: 0,
    matchLosses: 0,
    matchDraws: 0,
    gameWins: 0,
    gameLosses: 0,
  });
  e.matches += d.matches;
  e.matchWins += d.matchWins;
  e.matchLosses += d.matchLosses;
  e.matchDraws += d.matchDraws;
  e.gameWins += d.gameWins;
  e.gameLosses += d.gameLosses;
};

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

// A deck's color identity: colors on >10% of its non-land cards.
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

// Per-player standings for one record (match + game W/L/D, trophy).
const getStandings = (record: RawRecord): Standing[] => {
  const byPlayer: Record<string, Standing> = {};
  for (const p of record.players) {
    byPlayer[p.name] = {
      name: p.name,
      id: p.userId,
      matchWins: 0,
      matchLosses: 0,
      matchDraws: 0,
      gameWins: 0,
      gameLosses: 0,
      gameDraws: 0,
      trophy: record.trophy.includes(p.name),
    };
  }
  for (const round of record.matches) {
    for (const m of round.matches) {
      const p1 = byPlayer[m.p1];
      const p2 = byPlayer[m.p2];
      const g1 = m.results[0] ?? 0;
      const g2 = m.results[1] ?? 0;
      const d = m.results[2] ?? 0;
      if (p1) {
        p1.gameWins += g1;
        p1.gameLosses += g2;
        p1.gameDraws += d;
      }
      if (p2) {
        p2.gameWins += g2;
        p2.gameLosses += g1;
        p2.gameDraws += d;
      }
      if (g1 > g2) {
        if (p1) p1.matchWins += 1;
        if (p2) p2.matchLosses += 1;
      } else if (g1 < g2) {
        if (p1) p1.matchLosses += 1;
        if (p2) p2.matchWins += 1;
      } else {
        if (p1) p1.matchDraws += 1;
        if (p2) p2.matchDraws += 1;
      }
    }
  }
  return Object.values(byPlayer);
};

const MIN_PAIR_DECKS = 2;
const MIN_MATCHUP_MATCHES = 2;
const ELO_K = 24;

export async function runRecordAnalysis(
  csrfFetch: CsrfFetch,
  cube: Cube,
  cubeCards: Card[],
  callbacks: { onPhase: (p: RunPhase) => void; onModelProgress: (pct: number) => void; signal?: AbortSignal },
): Promise<RecordAnalysisRunData> {
  const { onPhase, onModelProgress, signal } = callbacks;
  const throwIfAborted = () => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  };

  // ── Fetch raw inputs ───────────────────────────────────────────────────────
  onPhase('setup');
  const res = await csrfFetch(`/cube/records/analysisdata/${encodeURIComponent(cube.id)}`, { method: 'GET' });
  const json = await res.json();
  if (!json?.success || !Array.isArray(json.records)) {
    throw new Error('Failed to load record data');
  }
  const records: RawRecord[] = json.records;
  const cardImages: { [oracle: string]: RecordCardInfo } = json.cards ?? {};
  throwIfAborted();

  // ── Aggregate (per-card, synergy pairs, matchups, players, decks) ──────────
  const cards: { [oracle: string]: Analytic } = {};
  const pairs: { [pairKey: string]: Analytic } = {};
  const matchups: { [key: string]: MatchupStat } = {};
  const playerAgg: Record<string, PlayerAnalytic> = {};
  const decks: AnalysisDeck[] = [];
  const deckIndexByKey: Record<string, number> = {};
  const matchEvents: { date: number; d1: string[]; d2: string[]; s1: number }[] = [];
  // Deck-vs-deck match results (by deck key), aggregated into an archetype-vs-
  // archetype matrix once clusters are known.
  const matchResults: { aKey: string; bKey: string; s1: number }[] = [];

  for (const record of records) {
    const standings = getStandings(record);
    const standingByName: Record<string, Standing> = {};
    for (const s of standings) standingByName[s.name] = s;

    for (const s of standings) {
      const key = s.id || s.name;
      const p = (playerAgg[key] ??= {
        name: s.name,
        userId: s.id,
        trophies: 0,
        matchWins: 0,
        matchLosses: 0,
        matchDraws: 0,
        events: 0,
      });
      p.events += 1;
      if (s.trophy) p.trophies += 1;
      p.matchWins += s.matchWins;
      p.matchLosses += s.matchLosses;
      p.matchDraws += s.matchDraws;
    }

    for (const [playerName, oracles] of Object.entries(record.decks)) {
      if (oracles.length === 0) continue;
      const s = standingByName[playerName];
      if (!s) continue;

      for (const oracle of oracles) addStanding(cards, oracle, s);
      for (let a = 0; a < oracles.length; a++) {
        for (let b = a + 1; b < oracles.length; b++) {
          addStanding(pairs, pairKey(oracles[a]!, oracles[b]!), s);
        }
      }

      deckIndexByKey[`${record.id}|${playerName}`] = decks.length;
      decks.push({
        recordId: record.id,
        recordName: record.name,
        date: record.date,
        playerName,
        userId: s.id,
        oracles,
        matchWins: s.matchWins,
        matchLosses: s.matchLosses,
        matchDraws: s.matchDraws,
        gameWins: s.gameWins,
        gameLosses: s.gameLosses,
        gameDraws: s.gameDraws,
        trophy: s.trophy,
        clusterId: null,
        x: 0,
        y: 0,
        colors: [],
        archetype: '',
      });
    }

    // Matchups + Elo events from each match's two decks.
    for (const round of record.matches) {
      for (const m of round.matches) {
        const d1 = record.decks[m.p1];
        const d2 = record.decks[m.p2];
        if (!d1 || !d2) continue;
        const g1 = m.results[0] ?? 0;
        const g2 = m.results[1] ?? 0;
        const win = g1 > g2 ? 1 : 0;
        const loss = g1 < g2 ? 1 : 0;
        const draw = g1 === g2 ? 1 : 0;
        const s1 = win ? 1 : draw ? 0.5 : 0;
        matchEvents.push({ date: record.date, d1, d2, s1 });
        matchResults.push({ aKey: `${record.id}|${m.p1}`, bKey: `${record.id}|${m.p2}`, s1 });
        for (const x of d1) {
          for (const y of d2) {
            if (x === y) continue;
            addMatchup(matchups, x, y, {
              matches: 1,
              matchWins: win,
              matchLosses: loss,
              matchDraws: draw,
              gameWins: g1,
              gameLosses: g2,
            });
            addMatchup(matchups, y, x, {
              matches: 1,
              matchWins: loss,
              matchLosses: win,
              matchDraws: draw,
              gameWins: g2,
              gameLosses: g1,
            });
          }
        }
      }
    }
  }

  // Prune low-sample pairs / matchups.
  const prunedPairs: { [k: string]: Analytic } = {};
  for (const [k, v] of Object.entries(pairs)) if (v.decks >= MIN_PAIR_DECKS) prunedPairs[k] = v;
  const prunedMatchups: { [k: string]: MatchupStat } = {};
  for (const [k, v] of Object.entries(matchups)) if (v.matches >= MIN_MATCHUP_MATCHES) prunedMatchups[k] = v;

  // Deck color identities — computed up front (not inside the ML clustering block)
  // so the color performance/matchup tables work even when clustering is skipped
  // or fails. Cube cards drive it; captured card info backfills cards no longer in
  // the live cube so their colors still count.
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
  for (const deck of decks) deck.colors = assessDeckColors(deck.oracles, colorMeta);

  // Color-vs-color head-to-head, from each deck-vs-deck result. A deck plays
  // every color in its identity (colorless decks bucket into 'C'), so a single
  // match feeds every (deck-A color) × (deck-B color) cell — a "contains" view.
  const colorMatchups: ColorMatchups = {};
  const colorsOf = (d: AnalysisDeck): string[] => (d.colors.length ? d.colors : ['C']);
  const addColorCell = (a: string, b: string, s: number) => {
    const e = (colorMatchups[`${a}|${b}`] ??= { matches: 0, wins: 0, draws: 0 });
    e.matches += 1;
    if (s === 1) e.wins += 1;
    else if (s === 0.5) e.draws += 1;
  };
  for (const mr of matchResults) {
    const ai = deckIndexByKey[mr.aKey];
    const bi = deckIndexByKey[mr.bKey];
    if (ai === undefined || bi === undefined) continue;
    const a = decks[ai];
    const b = decks[bi];
    if (!a || !b) continue;
    const sInv = mr.s1 === 1 ? 0 : mr.s1 === 0 ? 1 : 0.5;
    const ca = colorsOf(a);
    const cb = colorsOf(b);
    for (const x of ca) for (const y of cb) addColorCell(x, y, mr.s1);
    for (const x of cb) for (const y of ca) addColorCell(x, y, sInv);
  }

  // Match Elo (chronological replay; zero-sum; K=24).
  const elo: Record<string, number> = {};
  const getElo = (o: string) => elo[o] ?? 1200;
  const mean = (os: string[]) => (os.length ? os.reduce((sum, o) => sum + getElo(o), 0) / os.length : 1200);
  for (const ev of [...matchEvents].sort((a, b) => a.date - b.date)) {
    if (ev.d1.length === 0 || ev.d2.length === 0) continue;
    const expected1 = 1 / (1 + Math.pow(10, (mean(ev.d2) - mean(ev.d1)) / 400));
    const delta = ELO_K * (ev.s1 - expected1);
    for (const o of ev.d1) elo[o] = getElo(o) + delta;
    for (const o of ev.d2) elo[o] = getElo(o) - delta;
  }
  for (const [oracle, value] of Object.entries(elo)) {
    if (cards[oracle]) cards[oracle]!.matchElo = Math.round(value);
  }

  const players: PlayerAnalytic[] = Object.values(playerAgg).sort(
    (a, b) => b.trophies - a.trophies || b.matchWins - a.matchWins,
  );
  throwIfAborted();

  // ── Cluster decks into archetypes (ML model) ───────────────────────────────
  let skeletons: RecordAnalysisRunData['skeletons'] = [];
  let clusterMethod = '';
  let clustered = false;
  const clusterMatchups: ClusterMatchups = {};

  if (decks.length >= 3) {
    try {
      onPhase('loadmodel');
      await loadDraftBot(onModelProgress);
      throwIfAborted();

      onPhase('cluster');
      // Card metadata for the cube (land detection, ML remap), from the loaded cube.
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
      const pools = decks.map((deck) => deck.oracles);
      const flat = await encodePools(pools, oracleRemapping);
      const embeddings = reshapeEmbeddings(flat, pools.length);
      throwIfAborted();

      const slimPools: SlimPool[] = decks.map((deck, i) => ({
        draftIndex: 0,
        seatIndex: i,
        archetype: '',
        picks: deck.oracles.map((oracle, p) => ({ oracle_id: oracle, packNumber: 0, pickNumber: p + 1 })),
      }));
      const deckBuilds = decks.map((deck) => ({ mainboard: deck.oracles, sideboard: [] as string[] }));
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

      // Human archetype labels per deck (best-effort; falls back to colors only).
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

      // Archetype-vs-archetype matchup matrix from each deck-vs-deck result.
      const addCell = (a: number, b: number, s: number) => {
        const e = (clusterMatchups[`${a}|${b}`] ??= { matches: 0, wins: 0, draws: 0 });
        e.matches += 1;
        if (s === 1) e.wins += 1;
        else if (s === 0.5) e.draws += 1;
      };
      for (const mr of matchResults) {
        const ai = deckIndexByKey[mr.aKey];
        const bi = deckIndexByKey[mr.bKey];
        if (ai === undefined || bi === undefined) continue;
        const ca = decks[ai]?.clusterId ?? null;
        const cb = decks[bi]?.clusterId ?? null;
        if (ca === null || cb === null) continue;
        addCell(ca, cb, mr.s1);
        addCell(cb, ca, mr.s1 === 1 ? 0 : mr.s1 === 0 ? 1 : 0.5);
      }
      clustered = true;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      // Clustering is best-effort: keep the aggregate analysis even if the model
      // or encoding fails, just without the archetype map.

      console.error('Record-analysis clustering failed', err);
    }
  }

  onPhase('save');
  return {
    ts: Date.now(),
    generatedAt: new Date().toISOString(),
    recordCount: records.length,
    deckCount: decks.length,
    cards,
    pairs: prunedPairs,
    matchups: prunedMatchups,
    players,
    decks,
    skeletons,
    clusterMatchups,
    colorMatchups,
    cardImages,
    clusterMethod,
    clustered,
  };
}
