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
 * Resolve the ML oracle ID for a given oracle ID, applying the remapping for
 * cards not in the training vocabulary (e.g. Black Lotus → most similar known card).
 */
function mlOracle(oracle: string, remapping?: Record<string, string>): string {
  return remapping?.[oracle] ?? oracle;
}

/**
 * One-hot encode pools, forward pass through encoder + decoder, return raw logits.
 * pools[i] = oracle IDs whose bits are set to 1 in the input row.
 * remapping maps original oracle IDs to their ML-vocab equivalents for unknown cards.
 */
async function forwardPass(
  pools: string[][],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decoder: any,
  remapping?: Record<string, string>,
): Promise<Float32Array> {
  const N = pools.length;
  const poolData = new Float32Array(N * numOracles);
  for (let i = 0; i < N; i++) {
    const base = i * numOracles;
    for (const oracle of pools[i]!) {
      const idx = oracleToIndex[mlOracle(oracle, remapping)];
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

/**
 * Build an oracle remapping from CardMeta: maps original oracle ID → ML oracle ID
 * for cards whose mlOracleId differs (i.e. not in training vocab).
 */
export function buildOracleRemapping(
  cardMeta: Record<string, { mlOracleId?: string }>,
): Record<string, string> {
  const remapping: Record<string, string> = {};
  for (const [oracle, meta] of Object.entries(cardMeta)) {
    if (meta.mlOracleId) remapping[oracle] = meta.mlOracleId;
  }
  return remapping;
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
export async function localPickBatch(
  packs: string[][],
  pools: string[][],
  remapping?: Record<string, string>,
): Promise<string[]> {
  if (!_loaded || !tf || !encoder || !draftDecoder || packs.length === 0) {
    return packs.map(() => '');
  }

  const logits = await forwardPass(pools, draftDecoder, remapping);

  // Extract top pick per seat via pack-masked softmax
  return packs.map((pack, i) => {
    if (pack.length === 0) return '';
    const rowBase = i * numOracles;

    // Look up each pack card by its ML oracle; include all cards (unknown cards get
    // the logit of their remapped oracle, so Power cards are scored correctly)
    const entries: { oracle: string; raw: number }[] = pack.map((oracle) => {
      const idx = oracleToIndex[mlOracle(oracle, remapping)];
      return { oracle, raw: idx !== undefined ? (logits[rowBase + idx] ?? 0) : 0 };
    });

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
async function localBatchBuild(pools: string[][], remapping?: Record<string, string>): Promise<RatedCard[][]> {
  if (!_loaded || !tf || !encoder || !deckBuildDecoder || pools.length === 0) {
    return pools.map(() => []);
  }
  const logits = await forwardPass(pools, deckBuildDecoder, remapping);
  return pools.map((pool, i) => {
    const rowBase = i * numOracles;
    return pool
      .map((oracle) => {
        const idx = oracleToIndex[mlOracle(oracle, remapping)];
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
export async function localBatchDraftRanked(
  inputs: { pack: string[]; pool: string[] }[],
  remapping?: Record<string, string>,
): Promise<RatedCard[][]> {
  if (!_loaded || !tf || !encoder || !draftDecoder || inputs.length === 0) {
    return inputs.map(() => []);
  }
  const logits = await forwardPass(inputs.map((x) => x.pool), draftDecoder, remapping);
  return inputs.map(({ pack }, i) => {
    const rowBase = i * numOracles;
    return pack
      .map((oracle) => {
        const idx = oracleToIndex[mlOracle(oracle, remapping)];
        return { oracle, rating: idx !== undefined ? (logits[rowBase + idx] ?? 0) : 0 };
      })
      .sort((a, b) => b.rating - a.rating);
  });
}

export interface DeckbuildEntry {
  pool: string[];
  /** Card metadata keyed by oracle_id — needs type, colorIdentity, parsedCost, mlOracleId */
  cardMeta: Record<string, { type: string; colorIdentity: string[]; parsedCost?: string[]; producedMana?: string[]; mlOracleId?: string }>;
  basics: BasicLandInfo[];
  maxSpells?: number;
  maxLands?: number;
}

/**
 * Port of master's batchDeckbuild().
 * Phase 1: deck_build_decoder seeds first 10 cards per seat.
 * Phase 2: draft_decoder iteratively picks remaining cards until deck is full.
 * Fills remaining slots with basics using pipsPerSource from master.
 */
export async function localBatchDeckbuild(
  entries: DeckbuildEntry[],
): Promise<{ mainboard: string[]; sideboard: string[] }[]> {
  if (!_loaded || entries.length === 0) return entries.map(() => ({ mainboard: [], sideboard: [] }));

  const allPoolOracles = entries.map((e) => e.pool);
  const sharedRemapping = buildOracleRemapping(entries[0]!.cardMeta);

  const oracleIsLand = (oracle: string, meta: DeckbuildEntry['cardMeta']): boolean =>
    (meta[oracle]?.type ?? '').includes('Land');

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

  // Phase 1: seed first 10 cards via deck_build_decoder
  const buildResults = await localBatchBuild(allPoolOracles, sharedRemapping);

  for (let s = 0; s < seats.length; s++) {
    const seat = seats[s]!;
    const meta = entries[s]!.cardMeta;

    for (const item of buildResults[s] ?? []) {
      if (seat.mainboard.length >= 10) break;
      const oracle = item.oracle;
      const poolIdx = seat.remainingPool.indexOf(oracle);
      if (poolIdx === -1) continue;

      const land = oracleIsLand(oracle, meta);
      if (land && seat.landCount >= seat.maxLands) continue;
      if (!land && seat.spellCount >= seat.maxSpells) continue;

      const existing = seat.deckCopies[oracle] ?? 0;
      const adjustedRating = item.rating * Math.pow(0.9, existing);
      if (!Number.isFinite(adjustedRating)) continue;

      seat.mainboard.push(oracle);
      seat.deckCopies[oracle] = existing + 1;
      seat.remainingPool.splice(poolIdx, 1);
      if (land) seat.landCount += 1;
      else seat.spellCount += 1;
    }
  }

  // Phase 2: iteratively pick with draft_decoder until all seats are full
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
      // Deduplicate by ML oracle — mirrors master's toMl deduplication
      const seen = new Set<string>();
      const dedupedPack: string[] = [];
      for (const o of candidates) {
        const ml = sharedRemapping[o] ?? o;
        if (!seen.has(ml)) { seen.add(ml); dedupedPack.push(o); }
      }
      batchInputs.push({
        pack: dedupedPack,
        pool: seat.mainboard,
      });
    }

    if (batchInputs.length === 0) break;

    const batchResults = await localBatchDraftRanked(batchInputs, sharedRemapping);

    for (let i = 0; i < activeIndices.length; i++) {
      const s = activeIndices[i]!;
      const seat = seats[s]!;
      const candidates = batchInputs[i]!.pack;

      let bestOracle: string | null = null;
      let bestScore = -Infinity;

      for (const item of batchResults[i] ?? []) {
        if (!candidates.includes(item.oracle)) continue;
        const existing = seat.deckCopies[item.oracle] ?? 0;
        const adjusted = item.rating * Math.pow(0.9, existing);
        if (adjusted > bestScore) { bestScore = adjusted; bestOracle = item.oracle; }
      }

      if (!bestOracle || !Number.isFinite(bestScore)) continue;

      const poolIdx = seat.remainingPool.indexOf(bestOracle);
      if (poolIdx === -1) continue;

      seat.mainboard.push(bestOracle);
      seat.deckCopies[bestOracle] = (seat.deckCopies[bestOracle] ?? 0) + 1;
      seat.remainingPool.splice(poolIdx, 1);

      const land = oracleIsLand(bestOracle, entries[s]!.cardMeta);
      if (land) seat.landCount += 1;
      else seat.spellCount += 1;
      anyProgress = true;
    }
  }

  // Fill basics using pipsPerSource (port of master's calculateBasics)
  return seats.map((seat, s) => {
    const entry = entries[s]!;
    const meta = entry.cardMeta;
    const basicLands = entry.basics.filter((b) => b.type.includes('Land'));
    const needed = seat.deckSize - seat.mainboard.length;
    const basicOracles: string[] = [];

    for (let i = 0; i < needed && basicLands.length > 0; i++) {
      const pips: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
      const sources: Record<string, number> = { W: 1, U: 1, B: 1, R: 1, G: 1 };

      for (const oracle of [...seat.mainboard, ...basicOracles]) {
        const m = meta[oracle];
        const bMeta = entry.basics.find((b) => b.oracleId === oracle);
        const type = m?.type ?? bMeta?.type ?? '';
        const colorIdentity = m?.colorIdentity ?? bMeta?.colorIdentity ?? [];
        const parsedCost = m?.parsedCost ?? [];

        if (type.includes('Land')) {
          for (const c of colorIdentity) { if (sources[c] !== undefined) sources[c] += 1; }
        } else {
          for (const pip of parsedCost) {
            const c = pip.toUpperCase();
            if (pips[c] !== undefined) pips[c] += 1;
          }
        }
      }

      const ratio: Record<string, number> = {
        W: pips.W / sources.W, U: pips.U / sources.U,
        B: pips.B / sources.B, R: pips.R / sources.R, G: pips.G / sources.G,
      };

      let best = basicLands[0]!;
      let bestScore = best.colorIdentity.reduce((sum, c) => sum + (ratio[c] ?? 0), 0);
      for (let j = 1; j < basicLands.length; j++) {
        const b = basicLands[j]!;
        const sc = b.colorIdentity.reduce((sum, c) => sum + (ratio[c] ?? 0), 0);
        if (sc > bestScore) { bestScore = sc; best = b; }
      }
      basicOracles.push(best.oracleId);
    }

    return {
      mainboard: [...seat.mainboard, ...basicOracles].sort(),
      sideboard: seat.remainingPool.slice().sort(),
    };
  });
}
