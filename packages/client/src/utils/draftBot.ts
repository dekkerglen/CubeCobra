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
 * The recommender head (cube_decoder) is loaded lazily on demand so the normal
 * draft simulator path does not pay its download cost unless recommendations
 * are actually requested.
 *
 * Models are fetched through /api/mlmodel/* (a thin S3 proxy) and cached by
 * the browser via normal HTTP caching. TF.js itself is dynamically imported
 * to keep it out of the main bundle.
 */

import { BasicLandInfo } from '@utils/datatypes/SimulationReport';

const MODEL_BASE = '/api/mlmodel';

let tf: typeof import('@tensorflow/tfjs') | null = null;

let encoder: any = null;
let cubeContextEncoder: any = null;

const CUBE_CONTEXT_DIM = 32;

let draftDecoder: any = null;

let deckBuildDecoder: any = null;
let recommendDecoder: any = null;
let oracleToIndex: Record<string, number> = {};
let indexToOracle: string[] = [];
let numOracles = 0;
let draftBotLoaded = false;
let draftBotLoadPromise: Promise<void> | null = null;
let recommendLoadPromise: Promise<void> | null = null;
const loadProgressListeners = new Set<(pct: number) => void>();

const emitLoadProgress = (pct: number): void => {
  for (const listener of loadProgressListeners) {
    listener(pct);
  }
};

export function isDraftBotLoaded(): boolean {
  return draftBotLoaded;
}

/**
 * Lazily loads the oracle map, encoder, draft decoder, and deck build decoder.
 * Resolves immediately if already loaded.
 * onProgress receives values 0–100.
 */
export async function loadDraftBot(onProgress?: (pct: number) => void): Promise<void> {
  if (draftBotLoaded) {
    onProgress?.(100);
    return;
  }
  if (draftBotLoadPromise) {
    if (onProgress) loadProgressListeners.add(onProgress);
    try {
      await draftBotLoadPromise;
    } finally {
      if (onProgress) loadProgressListeners.delete(onProgress);
    }
    return;
  }
  if (onProgress) loadProgressListeners.add(onProgress);

  draftBotLoadPromise = (async () => {
    emitLoadProgress(0);

    // Dynamic import — keeps TF.js (~3 MB) out of the main bundle
    tf = await import('@tensorflow/tfjs');

    // Oracle index map (1.6 MB) — maps integer index → oracle_id
    const mapRes = await fetch(`${MODEL_BASE}/indexToOracleMap.json`);
    if (!mapRes.ok) throw new Error(`Failed to load oracle index map: ${mapRes.status}`);
    const oracleMap: Record<string, string> = await mapRes.json();
    numOracles = Object.keys(oracleMap).length;
    oracleToIndex = {};
    indexToOracle = new Array(numOracles);
    for (const [k, v] of Object.entries(oracleMap)) {
      oracleToIndex[v] = parseInt(k, 10);
      indexToOracle[parseInt(k, 10)] = v;
    }
    emitLoadProgress(5);

    // Encoder: [N, numOracles] → [N, 128]  (~69 MB weight shards)
    encoder = await tf.loadGraphModel(`${MODEL_BASE}/encoder/model.json`);
    emitLoadProgress(40);

    // Cube context encoder: [N, numOracles] → [N, 32]  (small model)
    cubeContextEncoder = await tf.loadGraphModel(`${MODEL_BASE}/cube_context_encoder/model.json`);
    emitLoadProgress(55);

    // Draft decoder: [N, 160] → [N, numOracles]  (takes pool[128] ⊕ cube_ctx[32])
    draftDecoder = await tf.loadGraphModel(`${MODEL_BASE}/draft_decoder/model.json`);
    emitLoadProgress(80);

    // Deck build decoder: [N, 128] → [N, numOracles]  (~69 MB weight shards)
    deckBuildDecoder = await tf.loadGraphModel(`${MODEL_BASE}/deck_build_decoder/model.json`);
    emitLoadProgress(100);

    draftBotLoaded = true;
  })();
  const activePromise = draftBotLoadPromise;

  try {
    await activePromise;
  } finally {
    if (onProgress) loadProgressListeners.delete(onProgress);
    if (draftBotLoadPromise === activePromise) draftBotLoadPromise = null;
  }
}

export function getLoadProgressListenerCountForTests(): number {
  return loadProgressListeners.size;
}

/**
 * Lazily loads the recommendation head used for add/cut style predictions.
 * The base encoder/draft/deckbuild models are loaded first if necessary.
 */
export async function loadDraftRecommender(): Promise<void> {
  await loadDraftBot();
  if (recommendDecoder) return;
  if (recommendLoadPromise) {
    await recommendLoadPromise;
    return;
  }

  recommendLoadPromise = (async () => {
    recommendDecoder = await tf!.loadGraphModel(`${MODEL_BASE}/cube_decoder/model.json`);
  })();
  const activePromise = recommendLoadPromise;

  try {
    await activePromise;
  } finally {
    if (recommendLoadPromise === activePromise) recommendLoadPromise = null;
  }
}

/**
 * Returns true if the given oracle ID (or its mlOracleId remap) is present in
 * the loaded model's vocabulary. Cards that return false will receive zero pick
 * ratings and be systematically underpicked — callers can use this to warn users.
 */
export function isOracleInVocab(oracle: string, remapping?: Record<string, string>): boolean {
  return oracleToIndex[remapping?.[oracle] ?? oracle] !== undefined;
}

/**
 * Returns the count of oracles in cardMeta that are missing from the model vocab
 * (after applying mlOracleId remapping). Useful for surfacing a warning when
 * a large fraction of cube cards are out-of-vocabulary.
 */
export function countOutOfVocabOracles(cardMeta: Record<string, { mlOracleId?: string }>): number {
  if (!draftBotLoaded) return 0;
  let count = 0;
  for (const [oracle, meta] of Object.entries(cardMeta)) {
    const resolved = meta.mlOracleId ?? oracle;
    if (oracleToIndex[resolved] === undefined) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Shared forward pass helper
// ---------------------------------------------------------------------------

export type RatedCard = { oracle: string; rating: number };
type MlSeatMaps = { toMl: Record<string, string>; fromMl: Record<string, string[]> };
type DeckCardMeta = DeckbuildEntry['cardMeta'][string];

/**
 * Resolve the ML oracle ID for a given oracle ID, applying the remapping for
 * cards not in the training vocabulary (e.g. Black Lotus → most similar known card).
 */
function mlOracle(oracle: string, remapping?: Record<string, string>): string {
  return remapping?.[oracle] ?? oracle;
}

/**
 * Thrown when a WebGL context loss or GPU OOM is detected during TF.js inference.
 * Callers can catch this specifically to surface a "try fewer drafts" message.
 */
export class WebGLInferenceError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'WebGLInferenceError';
    if (cause instanceof Error && cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

/** Returns true if an error looks like a WebGL context loss or GPU OOM. */
function isWebGLError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes('context_lost_webgl') ||
    msg.includes('webgl') ||
    msg.includes('clientwaitsync') ||
    msg.includes('invalid_operation') ||
    msg.includes('out of memory') ||
    msg.includes('gpu')
  );
}

/**
 * Maximum number of rows to process in a single WebGL forward pass.
 * Larger batches blow up GPU memory and trigger context_lost_webgl on
 * lower-end hardware or when numOracles × batchSize exceeds ~100 MB.
 * 32 rows × ~26 k oracles × 4 bytes ≈ 3.3 MB per shard — safely within budget.
 */
const WEBGL_CHUNK_SIZE = 32;

/**
 * Encodes the full cube card list through cube_context_encoder to produce a
 * 32-dim context vector. Call once per simulation run; pass the result to
 * localPickBatch so the draft decoder receives pool[128] ⊕ cube_ctx[32] = 160 dims.
 */
export async function computeCubeContext(
  cubeOracles: string[],
  remapping?: Record<string, string>,
): Promise<Float32Array> {
  if (!draftBotLoaded || !tf || !cubeContextEncoder) return new Float32Array(CUBE_CONTEXT_DIM);
  const vec = new Float32Array(numOracles);
  for (const oracle of cubeOracles) {
    const idx = oracleToIndex[mlOracle(oracle, remapping)];
    if (idx !== undefined) vec[idx] = 1;
  }
  const inputTensor = tf.tensor2d(vec, [1, numOracles]);
  try {
    const result = cubeContextEncoder.predict(inputTensor) as import('@tensorflow/tfjs').Tensor;
    const data = (await result.data()) as Float32Array;
    result.dispose();
    return data;
  } finally {
    inputTensor.dispose();
  }
}

/**
 * One-hot encode pools, forward pass through encoder + decoder, return raw logits.
 * pools[i] = oracle IDs whose bits are set to 1 in the input row.
 * remapping maps original oracle IDs to their ML-vocab equivalents for unknown cards.
 * chunkSize controls how many rows are processed per WebGL call (default WEBGL_CHUNK_SIZE).
 * cubeCtx (optional) — 32-dim cube context vector from computeCubeContext().
 *   When provided, it is concatenated with the encoder output before the draft decoder.
 */
async function forwardPass(
  pools: string[][],
  decoder: any,
  remapping?: Record<string, string>,
  chunkSize: number = WEBGL_CHUNK_SIZE,
  cubeCtx?: Float32Array,
): Promise<Float32Array> {
  const N = pools.length;
  if (N === 0) return new Float32Array(0);

  let out: Float32Array;
  try {
    out = new Float32Array(N * numOracles);
  } catch (err) {
    throw new WebGLInferenceError(
      `Not enough memory to run ${N} drafts — the result buffer alone needs ~${Math.round((N * numOracles * 4) / 1024 / 1024)} MB. Try fewer drafts.`,
      err,
    );
  }

  for (let start = 0; start < N; start += chunkSize) {
    const end = Math.min(start + chunkSize, N);
    const rows = end - start;
    const chunkData = new Float32Array(rows * numOracles);

    for (let i = 0; i < rows; i++) {
      const base = i * numOracles;
      for (const oracle of pools[start + i]!) {
        const idx = oracleToIndex[mlOracle(oracle, remapping)];
        if (idx !== undefined) chunkData[base + idx] = 1;
      }
    }

    let inputTensor: import('@tensorflow/tfjs').Tensor | null = null;
    let encoded: import('@tensorflow/tfjs').Tensor | null = null;
    let decoderInput: import('@tensorflow/tfjs').Tensor | null = null;
    let logitsTensor: import('@tensorflow/tfjs').Tensor | null = null;
    try {
      inputTensor = tf!.tensor2d(chunkData, [rows, numOracles]);
      encoded = encoder.predict(inputTensor) as import('@tensorflow/tfjs').Tensor;
      inputTensor.dispose();
      inputTensor = null;
      if (cubeCtx && cubeCtx.length > 0) {
        const ctxData = new Float32Array(rows * cubeCtx.length);
        for (let r = 0; r < rows; r++) ctxData.set(cubeCtx, r * cubeCtx.length);
        const ctxTensor = tf!.tensor2d(ctxData, [rows, cubeCtx.length]);
        decoderInput = tf!.concat([encoded, ctxTensor], 1);
        encoded.dispose();
        encoded = null;
        ctxTensor.dispose();
      } else {
        decoderInput = encoded;
        encoded = null;
      }
      logitsTensor = decoder.predict(decoderInput) as import('@tensorflow/tfjs').Tensor;
      decoderInput.dispose();
      decoderInput = null;
      const chunkLogits = (await logitsTensor.data()) as Float32Array;
      logitsTensor.dispose();
      logitsTensor = null;
      out.set(chunkLogits, start * numOracles);
    } catch (err) {
      inputTensor?.dispose();
      encoded?.dispose();
      decoderInput?.dispose();
      logitsTensor?.dispose();
      if (isWebGLError(err)) {
        throw new WebGLInferenceError(
          'WebGL context lost during inference — your GPU ran out of memory. Try running fewer drafts.',
          err,
        );
      }
      throw err;
    }
  }

  return out;
}

/**
 * Build an oracle remapping from CardMeta: maps original oracle ID → ML oracle ID
 * for cards whose mlOracleId differs (i.e. not in training vocab).
 */
export function buildOracleRemapping(cardMeta: Record<string, { mlOracleId?: string }>): Record<string, string> {
  const remapping: Record<string, string> = {};
  for (const [oracle, meta] of Object.entries(cardMeta)) {
    if (meta.mlOracleId) remapping[oracle] = meta.mlOracleId;
  }
  return remapping;
}

export function buildSeatMlMaps(poolOracles: string[], remapping?: Record<string, string>): MlSeatMaps {
  const toMl: Record<string, string> = {};
  const fromMl: Record<string, string[]> = {};

  for (const oracle of poolOracles) {
    if (toMl[oracle] !== undefined) continue;
    const mapped = mlOracle(oracle, remapping);
    toMl[oracle] = mapped;
    if (!fromMl[mapped]) fromMl[mapped] = [];
    if (!fromMl[mapped]!.includes(oracle)) fromMl[mapped]!.push(oracle);
  }

  return { toMl, fromMl };
}

// ---------------------------------------------------------------------------
// Embedding extraction (used for clustering / UMAP visualization)
// ---------------------------------------------------------------------------

const EMBEDDING_DIM = 128;

/**
 * Encode each pool/deck into a 128-dim embedding via the ML encoder.
 * pools[i] = oracle IDs whose bits should be set to 1 in the input.
 * Returns Float32Array of length N * 128 (row-major).
 */
export async function encodePools(
  pools: string[][],
  remapping?: Record<string, string>,
  chunkSize: number = WEBGL_CHUNK_SIZE,
): Promise<Float32Array> {
  const N = pools.length;
  if (N === 0) return new Float32Array(0);
  if (!draftBotLoaded || !tf || !encoder) {
    throw new Error('Draft bot must be loaded before encoding pools');
  }

  const out = new Float32Array(N * EMBEDDING_DIM);

  for (let start = 0; start < N; start += chunkSize) {
    const end = Math.min(start + chunkSize, N);
    const rows = end - start;
    const chunkData = new Float32Array(rows * numOracles);

    for (let i = 0; i < rows; i++) {
      const base = i * numOracles;
      for (const oracle of pools[start + i]!) {
        const idx = oracleToIndex[mlOracle(oracle, remapping)];
        if (idx !== undefined) chunkData[base + idx] = 1;
      }
    }

    let inputTensor: import('@tensorflow/tfjs').Tensor | null = null;
    let encoded: import('@tensorflow/tfjs').Tensor | null = null;
    try {
      inputTensor = tf.tensor2d(chunkData, [rows, numOracles]);
      encoded = encoder.predict(inputTensor) as import('@tensorflow/tfjs').Tensor;
      inputTensor.dispose();
      inputTensor = null;
      const embeddingData = (await encoded.data()) as Float32Array;
      encoded.dispose();
      encoded = null;
      out.set(embeddingData, start * EMBEDDING_DIM);
    } catch (err) {
      inputTensor?.dispose();
      encoded?.dispose();
      if (isWebGLError(err)) {
        throw new WebGLInferenceError(
          'WebGL context lost during encoding — your GPU ran out of memory. Try running fewer drafts.',
          err,
        );
      }
      throw err;
    }
  }

  return out;
}

/** Convert flat Float32Array of embeddings (N * 128) into number[][] for downstream use. */
export function reshapeEmbeddings(flat: Float32Array, n: number): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    const base = i * EMBEDDING_DIM;
    for (let j = 0; j < EMBEDDING_DIM; j++) row.push(flat[base + j]!);
    result.push(row);
  }
  return result;
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
  chunkSize?: number,
  cubeCtx?: Float32Array,
): Promise<string[]> {
  if (!draftBotLoaded || !tf || !encoder || !draftDecoder || packs.length === 0) {
    return packs.map(() => '');
  }
  if (numOracles === 0) throw new Error('Draft bot loaded but oracle vocabulary is empty — model may have loaded incorrectly.');

  const logits = await forwardPass(pools, draftDecoder, remapping, chunkSize, cubeCtx);

  // Extract top pick per seat via pack-masked argmax.
  // Softmax preserves the same ordering while doing substantially more work.
  return packs.map((pack, i) => {
    if (pack.length === 0) return '';
    const rowBase = i * numOracles;

    let bestOracle = '';
    let bestRaw = -Infinity;
    for (const oracle of pack) {
      const idx = oracleToIndex[mlOracle(oracle, remapping)];
      const raw = idx !== undefined ? (logits[rowBase + idx] ?? 0) : 0;
      if (raw > bestRaw) {
        bestRaw = raw;
        bestOracle = oracle;
      }
    }
    return bestOracle;
  });
}

// ---------------------------------------------------------------------------
// Deckbuilding
// ---------------------------------------------------------------------------

/**
 * Batch deckbuild seed: scores all pool cards per seat via the deck_build_decoder.
 * Returns cards sorted by descending rating for each seat.
 */
export async function localBatchBuild(
  pools: string[][],
  remapping?: Record<string, string>,
  chunkSize?: number,
): Promise<RatedCard[][]> {
  if (!draftBotLoaded || !tf || !encoder || !deckBuildDecoder || pools.length === 0) {
    return pools.map(() => []);
  }
  const logits = await forwardPass(pools, deckBuildDecoder, remapping, chunkSize);
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
  chunkSize?: number,
  cubeCtx?: Float32Array,
): Promise<RatedCard[][]> {
  if (!draftBotLoaded || !tf || !encoder || !draftDecoder || inputs.length === 0) {
    return inputs.map(() => []);
  }
  const logits = await forwardPass(
    inputs.map((x) => x.pool),
    draftDecoder,
    remapping,
    chunkSize,
    cubeCtx,
  );
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

/**
 * Recommend cards to add to or cut from a set of cards, using the same
 * encoder + cube decoder path as the server-side recommender service.
 */
export async function localRecommend(
  oracles: string[],
  remapping?: Record<string, string>,
): Promise<{ adds: RatedCard[]; cuts: RatedCard[] }> {
  if (oracles.length === 0) {
    return { adds: [], cuts: [] };
  }

  await loadDraftRecommender();

  if (!draftBotLoaded || !tf || !encoder || !recommendDecoder) {
    return { adds: [], cuts: [] };
  }

  const vector = new Float32Array(numOracles);
  const mappedInputs = new Set<string>();
  for (const oracle of oracles) {
    const mapped = mlOracle(oracle, remapping);
    const idx = oracleToIndex[mapped];
    if (idx === undefined) continue;
    vector[idx] = 1;
    mappedInputs.add(mapped);
  }

  let inputTensor: import('@tensorflow/tfjs').Tensor | null = null;
  let encoded: import('@tensorflow/tfjs').Tensor | null = null;
  let logitsTensor: import('@tensorflow/tfjs').Tensor | null = null;

  try {
    inputTensor = tf.tensor2d(vector, [1, numOracles]);
    encoded = encoder.predict(inputTensor) as import('@tensorflow/tfjs').Tensor;
    inputTensor.dispose();
    inputTensor = null;
    logitsTensor = recommendDecoder.predict([encoded]) as import('@tensorflow/tfjs').Tensor;
    encoded.dispose();
    encoded = null;
    const logits = (await logitsTensor.data()) as Float32Array;
    logitsTensor.dispose();
    logitsTensor = null;

    const adds: RatedCard[] = [];
    const cuts: RatedCard[] = [];

    for (let i = 0; i < numOracles; i++) {
      const oracle = indexToOracle[i];
      if (!oracle) continue;
      const item = { oracle, rating: logits[i] ?? 0 };
      if (mappedInputs.has(oracle)) {
        cuts.push(item);
      } else {
        adds.push(item);
      }
    }

    adds.sort((a, b) => b.rating - a.rating);
    cuts.sort((a, b) => a.rating - b.rating);
    return { adds, cuts };
  } catch (err) {
    inputTensor?.dispose();
    encoded?.dispose();
    logitsTensor?.dispose();
    if (isWebGLError(err)) {
      throw new WebGLInferenceError(
        'WebGL context lost during recommendation inference — your GPU ran out of memory.',
        err,
      );
    }
    throw err;
  }
}

export interface DeckbuildEntry {
  pool: string[];
  /** Card metadata keyed by oracle_id — needs type, colorIdentity, parsedCost, mlOracleId */
  cardMeta: Record<
    string,
    { type: string; colorIdentity: string[]; parsedCost?: string[]; producedMana?: string[]; mlOracleId?: string }
  >;
  basics: BasicLandInfo[];
  maxSpells?: number;
  maxLands?: number;
}

const throwIfAborted = (signal?: AbortSignal): void => {
  if (!signal?.aborted) return;
  throw new DOMException('Operation aborted', 'AbortError');
};

const oracleIsLand = (oracle: string, meta: DeckbuildEntry['cardMeta']): boolean =>
  /\bLand\b/.test(meta[oracle]?.type ?? '');

const getDeckCardMeta = (
  oracle: string,
  cardMeta: DeckbuildEntry['cardMeta'],
  basics: BasicLandInfo[],
): DeckCardMeta | BasicLandInfo | null => cardMeta[oracle] ?? basics.find((basic) => basic.oracleId === oracle) ?? null;

const deckCardColors = (card: DeckCardMeta | BasicLandInfo): string[] =>
  (card.producedMana ?? []).length > 0 ? (card.producedMana ?? []) : (card.colorIdentity ?? []);

export function colorDemandPerSource(cards: Array<DeckCardMeta | BasicLandInfo>): Record<string, number> {
  const demand: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const sources: Record<string, number> = { W: 1, U: 1, B: 1, R: 1, G: 1 };

  for (const card of cards) {
    if (/\bLand\b/.test(card.type ?? '')) {
      for (const color of deckCardColors(card)) {
        if (sources[color] !== undefined) sources[color] += 1;
      }
    } else {
      for (const color of card.colorIdentity ?? []) {
        if (demand[color] !== undefined) demand[color] += 1;
      }
    }
  }

  return {
    W: (demand.W ?? 0) / (sources.W ?? 1),
    U: (demand.U ?? 0) / (sources.U ?? 1),
    B: (demand.B ?? 0) / (sources.B ?? 1),
    R: (demand.R ?? 0) / (sources.R ?? 1),
    G: (demand.G ?? 0) / (sources.G ?? 1),
  };
}

export function calculateBasicsForDeck(
  mainboard: string[],
  basics: BasicLandInfo[],
  cardMeta: DeckbuildEntry['cardMeta'],
  deckSize: number,
): string[] {
  if (basics.length === 0) return [];

  const basicLands = basics.filter((basic) => basic.type.includes('Land'));
  if (basicLands.length === 0) return [];

  const result: string[] = [];
  const basicsNeeded = deckSize - mainboard.length;

  for (let i = 0; i < basicsNeeded; i++) {
    const cards = [...mainboard, ...result]
      .map((oracle) => getDeckCardMeta(oracle, cardMeta, basics))
      .filter((card): card is DeckCardMeta | BasicLandInfo => card !== null);
    const pips = colorDemandPerSource(cards);

    let bestBasic = basicLands[0]!;
    let bestScore = deckCardColors(bestBasic).reduce((sum, color) => sum + (pips[color] ?? 0), 0);

    for (let j = 1; j < basicLands.length; j++) {
      const candidate = basicLands[j]!;
      const score = deckCardColors(candidate).reduce((sum, color) => sum + (pips[color] ?? 0), 0);
      if (score > bestScore) {
        bestBasic = candidate;
        bestScore = score;
      }
    }

    result.push(bestBasic.oracleId);
  }

  return result;
}

export function chooseBestMappedOracle(
  ranked: RatedCard[],
  remainingCounts: Record<string, number>,
  deckCopies: Record<string, number>,
  fromMl: Record<string, string[]>,
): { oracle: string | null; score: number } {
  let bestOracle: string | null = null;
  let bestScore = -Infinity;

  for (const item of ranked) {
    const originals = fromMl[item.oracle] ?? [item.oracle];
    const oracle = originals.find((candidate) => (remainingCounts[candidate] ?? 0) > 0);
    if (!oracle) continue;

    const existing = deckCopies[oracle] ?? 0;
    const adjusted = item.rating * Math.pow(0.9, existing);
    if (adjusted > bestScore) {
      bestOracle = oracle;
      bestScore = adjusted;
    }
  }

  return { oracle: bestOracle, score: bestScore };
}

/**
 * Port of master's batchDeckbuild().
 * Phase 1: deck_build_decoder seeds first 10 cards per seat.
 * Phase 2: draft_decoder iteratively picks remaining cards until deck is full.
 * Fills remaining slots with basics using pipsPerSource from master.
 */
export async function localBatchDeckbuild(
  entries: DeckbuildEntry[],
  chunkSize?: number,
  signal?: AbortSignal,
): Promise<{ mainboard: string[]; sideboard: string[]; deckbuildRatings?: RatedCard[] }[]> {
  throwIfAborted(signal);
  if (!draftBotLoaded || entries.length === 0) return entries.map(() => ({ mainboard: [], sideboard: [] }));

  const allPoolOracles = entries.map((e) => e.pool);
  const sharedRemapping = buildOracleRemapping(entries[0]!.cardMeta);
  const seatMaps = allPoolOracles.map((poolOracles) => buildSeatMlMaps(poolOracles, sharedRemapping));
  const allPoolMlOracles = allPoolOracles.map((poolOracles, index) => {
    const { toMl } = seatMaps[index]!;
    return poolOracles.map((oracle) => toMl[oracle] ?? oracle);
  });

  // Per-seat state
  const seats = entries.map((entry) => {
    const maxSpells = entry.maxSpells ?? 23;
    const maxLands = entry.maxLands ?? 17;
    const remainingCounts: Record<string, number> = {};
    const remainingUnique: string[] = [];
    for (const oracle of entry.pool) {
      if ((remainingCounts[oracle] ?? 0) === 0) remainingUnique.push(oracle);
      remainingCounts[oracle] = (remainingCounts[oracle] ?? 0) + 1;
    }
    return {
      maxSpells,
      maxLands,
      deckSize: maxSpells + maxLands,
      mainboard: [] as string[],
      mlMainboard: [] as string[],
      originalPool: entry.pool,
      remainingCounts,
      remainingUnique,
      remainingCount: entry.pool.length,
      deckCopies: {} as Record<string, number>,
      spellCount: 0,
      landCount: 0,
    };
  });

  // Cube context for draft_decoder in Phase 2 (pool[128] ⊕ cube_ctx[32] = 160)
  const cubeCtx = await computeCubeContext(Object.keys(entries[0]!.cardMeta), sharedRemapping);

  // Phase 1: seed first 10 cards via deck_build_decoder
  const buildResults = await localBatchBuild(allPoolMlOracles, sharedRemapping, chunkSize);
  throwIfAborted(signal);

  for (let s = 0; s < seats.length; s++) {
    throwIfAborted(signal);
    const seat = seats[s]!;
    const meta = entries[s]!.cardMeta;
    const { fromMl } = seatMaps[s]!;

    for (const item of buildResults[s] ?? []) {
      if (seat.mainboard.length >= 10) break;

      const originals = fromMl[item.oracle] ?? [item.oracle];
      const oracle = originals.find((candidate) => (seat.remainingCounts[candidate] ?? 0) > 0);
      if (!oracle) continue;

      const land = oracleIsLand(oracle, meta);
      if (land && seat.landCount >= seat.maxLands) continue;
      if (!land && seat.spellCount >= seat.maxSpells) continue;

      const existing = seat.deckCopies[oracle] ?? 0;
      const adjustedRating = item.rating * Math.pow(0.9, existing);
      if (!Number.isFinite(adjustedRating)) continue;

      seat.mainboard.push(oracle);
      seat.mlMainboard.push(seatMaps[s]!.toMl[oracle] ?? oracle);
      seat.deckCopies[oracle] = existing + 1;
      seat.remainingCounts[oracle] = (seat.remainingCounts[oracle] ?? 0) - 1;
      seat.remainingCount -= 1;
      if (land) seat.landCount += 1;
      else seat.spellCount += 1;
    }
  }

  // Phase 2: iteratively pick with draft_decoder until all seats are full
  let anyProgress = true;
  while (anyProgress) {
    throwIfAborted(signal);
    anyProgress = false;
    const activeIndices: number[] = [];
    const batchInputs: { pack: string[]; pool: string[] }[] = [];

    for (let s = 0; s < seats.length; s++) {
      const seat = seats[s]!;
      const meta = entries[s]!.cardMeta;
      const { toMl } = seatMaps[s]!;
      if (seat.mainboard.length >= seat.deckSize || seat.remainingCount === 0) continue;

      const pack: string[] = [];
      const seenMl = new Set<string>();
      for (const oracle of seat.remainingUnique) {
        if ((seat.remainingCounts[oracle] ?? 0) <= 0) continue;
        const land = oracleIsLand(oracle, meta);
        if (land && seat.landCount >= seat.maxLands) continue;
        if (!land && seat.spellCount >= seat.maxSpells) continue;
        const mlOracleId = toMl[oracle] ?? oracle;
        if (seenMl.has(mlOracleId)) continue;
        seenMl.add(mlOracleId);
        pack.push(mlOracleId);
      }
      if (pack.length === 0) continue;

      activeIndices.push(s);
      batchInputs.push({
        pack,
        pool: seat.mlMainboard,
      });
    }

    if (batchInputs.length === 0) break;

    const batchResults = await localBatchDraftRanked(batchInputs, sharedRemapping, chunkSize, cubeCtx);
    throwIfAborted(signal);

    for (let i = 0; i < activeIndices.length; i++) {
      const s = activeIndices[i]!;
      const seat = seats[s]!;
      const { fromMl } = seatMaps[s]!;
      const { oracle: bestOracle, score: bestScore } = chooseBestMappedOracle(
        batchResults[i] ?? [],
        seat.remainingCounts,
        seat.deckCopies,
        fromMl,
      );

      if (!bestOracle || !Number.isFinite(bestScore)) continue;

      seat.mainboard.push(bestOracle);
      seat.mlMainboard.push(seatMaps[s]!.toMl[bestOracle] ?? bestOracle);
      seat.deckCopies[bestOracle] = (seat.deckCopies[bestOracle] ?? 0) + 1;
      seat.remainingCounts[bestOracle] = (seat.remainingCounts[bestOracle] ?? 0) - 1;
      seat.remainingCount -= 1;

      const land = oracleIsLand(bestOracle, entries[s]!.cardMeta);
      if (land) seat.landCount += 1;
      else seat.spellCount += 1;
      anyProgress = true;
    }
  }

  // Fill basics using pipsPerSource (port of master's calculateBasics)
  return seats.map((seat, s) => {
    const entry = entries[s]!;
    const basicOracles = calculateBasicsForDeck(seat.mainboard, entry.basics, entry.cardMeta, seat.deckSize);
    const sideboardCounts = { ...seat.remainingCounts };
    const sideboard = seat.originalPool.filter((oracle) => {
      if ((sideboardCounts[oracle] ?? 0) <= 0) return false;
      sideboardCounts[oracle] -= 1;
      return true;
    });

    // Map build ratings back to original oracle IDs
    const { fromMl } = seatMaps[s]!;
    const deckbuildRatings: RatedCard[] = (buildResults[s] ?? []).map((item) => {
      const originals = fromMl[item.oracle] ?? [item.oracle];
      return { oracle: originals[0] ?? item.oracle, rating: item.rating };
    });

    return {
      mainboard: [...seat.mainboard, ...basicOracles].sort(),
      sideboard: sideboard.sort(),
      deckbuildRatings,
    };
  });
}
