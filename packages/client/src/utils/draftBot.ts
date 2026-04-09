/**
 * Browser-side draft bot using TensorFlow.js.
 *
 * Mirrors the server's draftBatch() + simulateall logic exactly:
 *   1. Encode each pool as a one-hot vector over all oracle IDs
 *   2. Batch forward pass: encoder → draft_decoder → [N, numOracles] logits
 *   3. For each seat: mask to pack cards, softmax, return top pick
 *
 * Also implements client-side deckbuilding (batchDeckbuild equivalent):
 *   Phase 1: encoder → deck_build_decoder → seed first 10 cards from pool
 *   Phase 2: encoder → draft_decoder → iteratively fill remaining slots
 *
 * Models are fetched through /api/mlmodel/* (a thin S3 proxy) and cached by
 * the browser via normal HTTP caching. TF.js itself is dynamically imported
 * to keep it out of the main bundle.
 */

import { BasicLandInfo } from '@utils/datatypes/SimulationReport';

const MODEL_BASE = '/api/mlmodel';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tf: typeof import('@tensorflow/tfjs') | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let encoder: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let draftDecoder: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let deckBuildDecoder: any = null;
let oracleToIndex: Record<string, number> = {};
let numOracles = 0;
let _loaded = false;

export function isDraftBotLoaded(): boolean {
  return _loaded;
}

/**
 * Lazily loads the oracle map, encoder, draft decoder, and deck build decoder.
 * Resolves immediately if already loaded.
 * onProgress receives values 0–100.
 */
export async function loadDraftBot(onProgress?: (pct: number) => void): Promise<void> {
  if (_loaded) return;

  onProgress?.(0);

  // Dynamic import — keeps TF.js (~3 MB) out of the main bundle
  tf = await import('@tensorflow/tfjs');

  // Oracle index map (1.6 MB) — maps integer index → oracle_id
  const mapRes = await fetch(`${MODEL_BASE}/indexToOracleMap.json`);
  if (!mapRes.ok) throw new Error(`Failed to load oracle index map: ${mapRes.status}`);
  const indexToOracle: Record<string, string> = await mapRes.json();
  numOracles = Object.keys(indexToOracle).length;
  oracleToIndex = {};
  for (const [k, v] of Object.entries(indexToOracle)) {
    oracleToIndex[v] = parseInt(k, 10);
  }
  onProgress?.(5);

  // Encoder: [N, numOracles] → [N, 128]  (~69 MB weight shards)
  encoder = await tf.loadGraphModel(`${MODEL_BASE}/encoder/model.json`);
  onProgress?.(45);

  // Draft decoder: [N, 128] → [N, numOracles]  (~69 MB weight shards)
  draftDecoder = await tf.loadGraphModel(`${MODEL_BASE}/draft_decoder/model.json`);
  onProgress?.(75);

  // Deck build decoder: [N, 128] → [N, numOracles]  (~69 MB weight shards)
  deckBuildDecoder = await tf.loadGraphModel(`${MODEL_BASE}/deck_build_decoder/model.json`);
  onProgress?.(100);

  _loaded = true;
}

// ---------------------------------------------------------------------------
// Shared forward pass helper
// ---------------------------------------------------------------------------

type RatedCard = { oracle: string; rating: number };

/**
 * One-hot encode pools, forward pass through encoder + decoder, return raw logits.
 * pools[i] = oracle IDs whose bits are set to 1 in the input row.
 */
async function forwardPass(
  pools: string[][],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decoder: any,
): Promise<Float32Array> {
  const N = pools.length;
  const poolData = new Float32Array(N * numOracles);
  for (let i = 0; i < N; i++) {
    const base = i * numOracles;
    for (const oracle of pools[i]!) {
      const idx = oracleToIndex[oracle];
      if (idx !== undefined) poolData[base + idx] = 1;
    }
  }
  const inputTensor = tf!.tensor2d(poolData, [N, numOracles]);
  const encoded = encoder.predict(inputTensor) as import('@tensorflow/tfjs').Tensor;
  inputTensor.dispose();
  const logitsTensor = decoder.predict(encoded) as import('@tensorflow/tfjs').Tensor;
  encoded.dispose();
  const logits = (await logitsTensor.data()) as Float32Array;
  logitsTensor.dispose();
  return logits;
}

// ---------------------------------------------------------------------------
// Draft picking (used during simulation)
// ---------------------------------------------------------------------------

/**
 * Picks one card per seat for a single pick round.
 * Exact port of the server's draftBatch() + simulateall top-1 extraction.
 *
 * packs[i]  — oracle IDs available to pick in seat i's current pack
 * pools[i]  — oracle IDs already drafted by seat i
 * Returns an oracle ID per seat (empty string if pack is empty or model unavailable).
 */
export async function localPickBatch(packs: string[][], pools: string[][]): Promise<string[]> {
  if (!_loaded || !tf || !encoder || !draftDecoder || packs.length === 0) {
    return packs.map(() => '');
  }

  const logits = await forwardPass(pools, draftDecoder);

  // Extract top pick per seat via pack-masked softmax
  return packs.map((pack, i) => {
    if (pack.length === 0) return '';
    const rowBase = i * numOracles;

    const entries: { oracle: string; raw: number }[] = [];
    for (const oracle of pack) {
      const idx = oracleToIndex[oracle];
      if (idx !== undefined) entries.push({ oracle, raw: logits[rowBase + idx] ?? 0 });
    }
    if (entries.length === 0) return '';

    // Numerically stable softmax over pack cards only
    const raws = entries.map((e) => e.raw);
    const max = Math.max(...raws);
    const exps = raws.map((r) => Math.exp(r - max));
    const sum = exps.reduce((a, b) => a + b, 0);

    let bestIdx = 0;
    let bestProb = -Infinity;
    for (let j = 0; j < exps.length; j++) {
      const prob = (exps[j] ?? 0) / sum;
      if (prob > bestProb) {
        bestProb = prob;
        bestIdx = j;
      }
    }
    return entries[bestIdx]?.oracle ?? '';
  });
}

// ---------------------------------------------------------------------------
// Deckbuilding
// ---------------------------------------------------------------------------

/**
 * Batch deckbuild seed: scores all pool cards per seat via the deck_build_decoder.
 * Returns cards sorted by descending rating for each seat.
 */
async function localBatchBuild(pools: string[][]): Promise<RatedCard[][]> {
  if (!_loaded || !tf || !encoder || !deckBuildDecoder || pools.length === 0) {
    return pools.map(() => []);
  }
  const logits = await forwardPass(pools, deckBuildDecoder);
  return pools.map((pool, i) => {
    const rowBase = i * numOracles;
    return pool
      .map((oracle) => {
        const idx = oracleToIndex[oracle];
        return { oracle, rating: idx !== undefined ? (logits[rowBase + idx] ?? 0) : 0 };
      })
      .sort((a, b) => b.rating - a.rating);
  });
}

/**
 * Batch draft pick (ranked): scores all candidate cards per seat via the draft_decoder.
 * Returns cards sorted by descending rating for each seat.
 * Exported for use in normal drafts (CubeDraftPage).
 */
export async function localBatchDraftRanked(inputs: { pack: string[]; pool: string[] }[]): Promise<RatedCard[][]> {
  if (!_loaded || !tf || !encoder || !draftDecoder || inputs.length === 0) {
    return inputs.map(() => []);
  }
  const logits = await forwardPass(inputs.map((x) => x.pool), draftDecoder);
  return inputs.map(({ pack }, i) => {
    const rowBase = i * numOracles;
    return pack
      .map((oracle) => {
        const idx = oracleToIndex[oracle];
        return { oracle, rating: idx !== undefined ? (logits[rowBase + idx] ?? 0) : 0 };
      })
      .sort((a, b) => b.rating - a.rating);
  });
}

/**
 * Fills remaining deck slots with basic lands, picking the basic that best satisfies
 * the current deck's color demand relative to mana sources already present.
 * Port of server's calculateBasics() in draftbots.ts.
 */
function fillBasics(
  mainboardOracles: string[],
  mainboardMeta: { type: string; colorIdentity: string[]; producedMana?: string[] }[],
  basics: BasicLandInfo[],
  deckSize: number,
): string[] {
  const needed = deckSize - mainboardOracles.length;
  if (needed <= 0 || basics.length === 0) return [];

  const basicLands = basics.filter((b) => b.type.includes('Land'));
  if (basicLands.length === 0) return [];

  const result: string[] = [];
  const resultMeta: { type: string; colorIdentity: string[]; producedMana: string[] }[] = [];

  for (let i = 0; i < needed; i++) {
    const demand: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    const sources: Record<string, number> = { W: 1, U: 1, B: 1, R: 1, G: 1 };

    // Combine mainboard + basics added so far
    const allCards = [
      ...mainboardMeta.map((m) => ({ type: m.type, colorIdentity: m.colorIdentity, producedMana: m.producedMana ?? [] })),
      ...resultMeta,
    ];

    for (const card of allCards) {
      if (card.type.includes('Land')) {
        const produced = card.producedMana.length > 0 ? card.producedMana : card.colorIdentity;
        for (const color of produced) {
          if (sources[color] !== undefined) sources[color] += 1;
        }
      } else {
        for (const color of card.colorIdentity) {
          if (demand[color] !== undefined) demand[color] += 1;
        }
      }
    }

    const pips: Record<string, number> = {
      W: (demand.W ?? 0) / (sources.W ?? 1),
      U: (demand.U ?? 0) / (sources.U ?? 1),
      B: (demand.B ?? 0) / (sources.B ?? 1),
      R: (demand.R ?? 0) / (sources.R ?? 1),
      G: (demand.G ?? 0) / (sources.G ?? 1),
    };

    let bestBasic = basicLands[0]!;
    const score = (b: BasicLandInfo) =>
      (b.producedMana.length > 0 ? b.producedMana : b.colorIdentity).reduce((s, c) => s + (pips[c] ?? 0), 0);
    let bestScore = score(bestBasic);
    for (let j = 1; j < basicLands.length; j++) {
      const s = score(basicLands[j]!);
      if (s > bestScore) { bestScore = s; bestBasic = basicLands[j]!; }
    }

    result.push(bestBasic.oracleId);
    resultMeta.push({ type: bestBasic.type, colorIdentity: bestBasic.colorIdentity, producedMana: bestBasic.producedMana });
  }

  return result;
}

export interface DeckbuildEntry {
  pool: string[];
  /** Type/color metadata for pool cards — keyed by oracle_id */
  cardMeta: Record<string, { type: string; colorIdentity: string[]; producedMana?: string[] }>;
  basics: BasicLandInfo[];
  maxSpells?: number;
  maxLands?: number;
}

/**
 * Client-side port of server's batchDeckbuild().
 * Phase 1: deck_build_decoder seeds first 10 cards from each pool.
 * Phase 2: draft_decoder iteratively picks remaining cards until deck is full.
 * Then fills remaining slots with basic lands.
 */
export async function localBatchDeckbuild(
  entries: DeckbuildEntry[],
): Promise<{ mainboard: string[]; sideboard: string[] }[]> {
  if (!_loaded || entries.length === 0) return entries.map(() => ({ mainboard: [], sideboard: [] }));

  const allPoolOracles = entries.map((e) => e.pool);

  // Per-seat state
  const seats = entries.map((entry) => {
    const maxSpells = entry.maxSpells ?? 23;
    const maxLands = entry.maxLands ?? 17;
    return {
      maxSpells,
      maxLands,
      deckSize: maxSpells + maxLands,
      mainboard: [] as string[],
      remainingPool: [...entry.pool],
      deckCopies: {} as Record<string, number>,
      spellCount: 0,
      landCount: 0,
    };
  });

  const oracleIsLand = (oracle: string, meta: DeckbuildEntry['cardMeta']): boolean =>
    !!(meta[oracle]?.type ?? '').includes('Land');

  // Phase 1: Seed first 10 cards via deck_build_decoder
  const buildResults = await localBatchBuild(allPoolOracles);

  for (let s = 0; s < seats.length; s++) {
    const seat = seats[s]!;
    const meta = entries[s]!.cardMeta;

    for (const item of buildResults[s] ?? []) {
      if (seat.mainboard.length >= 10) break;
      const oracle = item.oracle;
      if (!seat.remainingPool.includes(oracle)) continue;

      const land = oracleIsLand(oracle, meta);
      if (land && seat.landCount >= seat.maxLands) continue;
      if (!land && seat.spellCount >= seat.maxSpells) continue;

      const existing = seat.deckCopies[oracle] ?? 0;
      if (item.rating * Math.pow(0.9, existing) <= 0) continue;

      seat.mainboard.push(oracle);
      seat.deckCopies[oracle] = existing + 1;
      seat.remainingPool.splice(seat.remainingPool.indexOf(oracle), 1);
      if (land) seat.landCount += 1;
      else seat.spellCount += 1;
    }
  }

  // Phase 2: Iteratively pick with draft_decoder until all seats are full
  let anyProgress = true;
  while (anyProgress) {
    anyProgress = false;

    const activeIndices: number[] = [];
    const batchInputs: { pack: string[]; pool: string[] }[] = [];

    for (let s = 0; s < seats.length; s++) {
      const seat = seats[s]!;
      const meta = entries[s]!.cardMeta;
      if (seat.mainboard.length >= seat.deckSize || seat.remainingPool.length === 0) continue;

      const candidates = seat.remainingPool.filter((oracle) => {
        const land = oracleIsLand(oracle, meta);
        if (land && seat.landCount >= seat.maxLands) return false;
        if (!land && seat.spellCount >= seat.maxSpells) return false;
        return true;
      });
      if (candidates.length === 0) continue;

      activeIndices.push(s);
      batchInputs.push({ pack: [...new Set(candidates)], pool: seat.mainboard });
    }

    if (batchInputs.length === 0) break;

    const batchResults = await localBatchDraftRanked(batchInputs);

    for (let i = 0; i < activeIndices.length; i++) {
      const s = activeIndices[i]!;
      const seat = seats[s]!;
      const meta = entries[s]!.cardMeta;
      const candidates = batchInputs[i]!.pack;

      let bestOracle: string | null = null;
      let bestScore = -Infinity;

      for (const item of batchResults[i] ?? []) {
        const oracle = item.oracle;
        if (!candidates.includes(oracle)) continue;
        const existing = seat.deckCopies[oracle] ?? 0;
        const adjusted = item.rating * Math.pow(0.9, existing);
        if (adjusted > bestScore) { bestScore = adjusted; bestOracle = oracle; }
      }

      if (!bestOracle || bestScore <= 0) continue;

      const poolIdx = seat.remainingPool.indexOf(bestOracle);
      if (poolIdx === -1) continue;

      seat.mainboard.push(bestOracle);
      seat.deckCopies[bestOracle] = (seat.deckCopies[bestOracle] ?? 0) + 1;
      seat.remainingPool.splice(poolIdx, 1);

      const land = oracleIsLand(bestOracle, meta);
      if (land) seat.landCount += 1;
      else seat.spellCount += 1;

      anyProgress = true;
    }
  }

  // Fill basics and return
  return seats.map((seat, s) => {
    const entry = entries[s]!;
    const mainboardMeta = seat.mainboard.map((o) => entry.cardMeta[o] ?? { type: '', colorIdentity: [], producedMana: [] });
    const basicOracles = fillBasics(seat.mainboard, mainboardMeta, entry.basics, seat.deckSize);
    const fullMainboard = [...seat.mainboard, ...basicOracles].sort();
    return {
      mainboard: fullMainboard,
      sideboard: seat.remainingPool.slice().sort(),
    };
  });
}
