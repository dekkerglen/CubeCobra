import { concat, type GraphModel, loadGraphModel, tensor, tidy } from '@tensorflow/tfjs-node';
import { readFileSync } from 'fs';
import path from 'path';

import 'dotenv/config';

import { getAllOracleIds } from './cardCatalog';
import cloudwatch from './cloudwatch';

let indexToOracle: Record<number, string> = {};
let oracleToIndex: Record<string, number> = {};
let numOracles = 0;

let encoder: GraphModel;
let recommendDecoder: GraphModel;
let deckbuilderDecoder: GraphModel;
let draftDecoder: GraphModel;
let cubeContextEncoder: GraphModel;
// draft_decoder takes pool[128] ⊕ cube_ctx_vec[32] = 160-dim.
const CUBE_CONTEXT_DIM = 32;

// The recommend decoder scores the entire oracle vocabulary (~30k cards).
// Returning every non-cube card as an `add` produced a ~3 MB JSON response.
// This recommender is single-threaded (Node + TF) and its event loop is
// saturated by batchdraft tensor ops, so it could not flush a 3 MB body
// before the caller's 10s timeout fired — every overlapping Smart Search
// request aborted.
//
// The fix has two paths:
//   - Smart Search passes `eligibleOracles` (the oracle ids that matched the
//     server-side filter) plus skip/limit; we rank just that subset and return
//     only the requested page — a few KB.
//   - Callers with no filter context (the cuts endpoint, Seed Crystal) get a
//     bounded top-N ranking so the response can't balloon back to multi-MB.
//     5000 keeps the response ~0.5 MB and still gives Seed Crystal ample
//     candidate headroom (it targets ~2x cube size).
const MAX_RECOMMEND_ADDS = 5000;

const errorHandler = (modelName: string, err: { message: any; stack: any }) => {
  if (process.env?.NODE_ENV === 'development') {
    console.warn(`${modelName} not found, bot stuff will not work as expected`);
  } else {
    cloudwatch.error(err.message, err.stack);
  }
};

export async function initializeMl(rootDir: string = '.') {
  console.info('Loading ML models...');

  // Load the oracle mapping
  const oracleMapPath = path.join(rootDir, 'model', 'indexToOracleMap.json');
  indexToOracle = JSON.parse(readFileSync(oracleMapPath, 'utf8'));
  oracleToIndex = Object.fromEntries(Object.entries(indexToOracle).map(([key, value]) => [value, parseInt(key, 10)]));
  numOracles = Object.keys(oracleToIndex).length;

  // Load models
  const modelPromises = [
    loadGraphModel(`file://${path.join(rootDir, 'model', 'encoder', 'model.json')}`)
      .then((model) => {
        encoder = model;
        console.info('encoder loaded');
      })
      .catch((err: { message: any; stack: any }) => {
        errorHandler('encoder', err);
      }),

    loadGraphModel(`file://${path.join(rootDir, 'model', 'cube_decoder', 'model.json')}`)
      .then((model) => {
        recommendDecoder = model;
        console.info('recommend_decoder loaded');
      })
      .catch((err: { message: any; stack: any }) => {
        errorHandler('recommend_decoder', err);
      }),

    loadGraphModel(`file://${path.join(rootDir, 'model', 'deck_build_decoder', 'model.json')}`)
      .then((model) => {
        deckbuilderDecoder = model;
        console.info('deck_build_decoder loaded');
      })
      .catch((err: { message: any; stack: any }) => {
        errorHandler('deck_build_decoder', err);
      }),

    loadGraphModel(`file://${path.join(rootDir, 'model', 'draft_decoder', 'model.json')}`)
      .then((model) => {
        draftDecoder = model;
        console.info('draft_decoder loaded');
      })
      .catch((err: { message: any; stack: any }) => {
        errorHandler('draft_decoder', err);
      }),

    loadGraphModel(`file://${path.join(rootDir, 'model', 'cube_context_encoder', 'model.json')}`)
      .then((model) => {
        cubeContextEncoder = model;
        console.info('cube_context_encoder loaded');
      })
      .catch((err: { message: any; stack: any }) => {
        errorHandler('cube_context_encoder', err);
      }),
  ];

  await Promise.allSettled(modelPromises);
  console.info('Finished loading ML models.');
}

/**
 * Helper for waiting until all ML models to be loaded before proceeding.
 */
export const ensureModelsReady = (timeout = 30000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const checkModels = () => {
      return encoder && recommendDecoder && deckbuilderDecoder && draftDecoder && cubeContextEncoder;
    };

    if (checkModels()) {
      resolve();
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      if (checkModels()) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        reject(new Error('Timeout waiting for ML models to load'));
      }
    }, 500);
  });
};

const softmax = (array: number[]) => {
  const max = Math.max(...array);
  const exps = array.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((value) => value / sum);
};

const encodeIndeces = (indeces: number[]) => {
  const tensor = new Array(numOracles).fill(0);

  indeces
    .filter((index) => index !== null && index !== undefined)
    .forEach((index) => {
      tensor[index] = 1;
    });

  return tensor;
};

export const encode = (oracles: string[]) => {
  if (!encoder) {
    return [];
  }

  const vector = [
    encodeIndeces(
      oracles.map((oracle) => oracleToIndex[oracle]).filter((index): index is number => index !== undefined),
    ),
  ];

  return tidy(() => {
    const inputTensor = tensor(vector);
    const result = encoder.predict(inputTensor) as any;
    return result.dataSync();
  });
};

export const encodeCubeContext = (oracles: string[]): number[] => {
  if (!cubeContextEncoder) {
    return new Array(CUBE_CONTEXT_DIM).fill(0);
  }

  const vector = [
    encodeIndeces(
      oracles.map((oracle) => oracleToIndex[oracle]).filter((index): index is number => index !== undefined),
    ),
  ];

  return tidy(() => {
    const inputTensor = tensor(vector);
    const result = cubeContextEncoder.predict(inputTensor) as any;
    const flat = result.dataSync();
    return Array.from(flat) as number[];
  });
};

export const batchEncode = (inputs: string[][]): number[][] => {
  if (!encoder || inputs.length === 0) {
    return inputs.map(() => []);
  }

  const vectors = inputs.map((oracles) =>
    encodeIndeces(
      oracles.map((oracle) => oracleToIndex[oracle]).filter((index): index is number => index !== undefined),
    ),
  );

  return tidy(() => {
    const inputTensor = tensor(vectors);
    const result = encoder.predict(inputTensor) as any;
    return result.arraySync();
  });
};

const oracleIdToMlIndex = (oracleId: string) => {
  const oracleIndex = oracleToIndex[oracleId];

  if (oracleIndex !== undefined) {
    return oracleIndex;
  }

  // Card not in ML index - filtering is now done on server side
  return null;
};

export type RatedOracle = { oracle: string; rating: number };

export interface RecommendOptions {
  // The user's filter has already been applied server-side; these are the
  // oracle ids of cards eligible to be `add`ed. When present we rank only this
  // subset and return just the requested page.
  //
  // We pass oracle ids (not ML indices): the oracle<->index mapping lives
  // entirely inside this service, so the server and recommender never need to
  // agree on an index table. Passing indices would couple them to identical
  // index maps — and any drift silently corrupts ratings (array[wrongIndex]).
  // Cards already in the cube (`oracles`) are excluded from the ranking here.
  eligibleOracles?: string[];
  // Pagination range over the ranked `adds` list. Ignored if eligibleOracles
  // is absent.
  skip?: number;
  limit?: number;
}

export interface RecommendResult {
  // Filtered path: the ranked page (oracle ids). No-filter path (cuts
  // endpoint, Seed Crystal): ranked non-cube oracle ids, capped.
  adds: RatedOracle[];
  cuts: RatedOracle[];
  // Total number of eligible adds before pagination, so the caller can decide
  // whether more pages exist.
  totalAdds: number;
}

export const recommend = (oracles: string[], options?: RecommendOptions): RecommendResult => {
  console.log(`[ML] recommend() called with ${oracles.length} oracles`);

  if (!encoder || !recommendDecoder) {
    console.log('[ML] Models not loaded - encoder or recommendDecoder is null');
    return { adds: [], cuts: [], totalAdds: 0 };
  }

  const mappedIndices = oracles
    .map((oracle) => oracleIdToMlIndex(oracle))
    .filter((index): index is number => index !== null && index !== undefined);

  console.log(`[ML] Mapped ${mappedIndices.length} of ${oracles.length} oracles to indices`);

  const vector = [encodeIndeces(mappedIndices)];

  const array = tidy(() => {
    const inputTensor = tensor(vector);
    const encoded = encoder.predict(inputTensor) as any;

    const result = recommendDecoder.predict([encoded]) as any;
    return result.dataSync();
  });

  // Rating for a single oracle, or null if the model has no index for it.
  const ratingFor = (oracle: string): number | null => {
    const index = oracleIdToMlIndex(oracle);
    if (index === null || index === undefined) return null;
    return array[index] ?? 0;
  };

  const oracleSet = new Set(oracles);

  // cuts: every (unique) cube card the model knows, scored worst-first.
  const cuts: RatedOracle[] = [];
  for (const oracle of oracleSet) {
    const rating = ratingFor(oracle);
    if (rating === null) continue;
    cuts.push({ oracle, rating });
  }
  cuts.sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0));

  let adds: RatedOracle[] = [];
  let totalAdds: number;

  if (options?.eligibleOracles) {
    // Filtered path: the server already applied the user's filter. Rank the
    // eligible oracles by score and slice the requested page. Cards the model
    // doesn't know are appended last (rating 0), mirroring the prior
    // "unscored sorts to the bottom" behavior.
    //
    // Exclude cards already in the cube — they aren't "adds". Done here (not
    // just trusting the caller) because the recommender natively has the cube
    // oracles, and this is where the adds/cuts split has always lived.
    const scored: RatedOracle[] = [];
    const unscored: RatedOracle[] = [];
    for (const oracle of options.eligibleOracles) {
      if (oracleSet.has(oracle)) continue; // already in the cube
      const rating = ratingFor(oracle);
      if (rating === null) {
        unscored.push({ oracle, rating: 0 });
      } else {
        scored.push({ oracle, rating });
      }
    }
    scored.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    const ranked = scored.concat(unscored);
    totalAdds = ranked.length;

    const skip = Math.max(0, Math.floor(options.skip ?? 0));
    const limit = options.limit !== undefined && options.limit > 0 ? Math.floor(options.limit) : ranked.length - skip;
    adds = ranked.slice(skip, skip + limit);
    console.log(
      `[ML] recommend() ranked ${totalAdds} eligible adds, returning page [${skip}, ${skip + adds.length}), ${cuts.length} cuts`,
    );
  } else {
    // No filter context (cuts endpoint, Seed Crystal): rank every non-cube
    // oracle, but cap the response at MAX_RECOMMEND_ADDS so it can't balloon.
    const ranked: RatedOracle[] = [];
    for (const oracle of getAllOracleIds()) {
      if (oracleSet.has(oracle)) continue;
      const rating = ratingFor(oracle);
      if (rating === null) continue;
      ranked.push({ oracle, rating });
    }
    ranked.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    totalAdds = ranked.length;
    adds = ranked.slice(0, MAX_RECOMMEND_ADDS);
    console.log(`[ML] recommend() returning ${adds.length} adds (capped from ${totalAdds}), ${cuts.length} cuts`);
  }

  return { adds, cuts, totalAdds };
};

export const build = (oracles: string[]) => {
  if (!encoder || !deckbuilderDecoder) {
    return [];
  }
  const allOracles = getAllOracleIds();

  const array = tidy(() => {
    const vector = [
      encodeIndeces(
        oracles
          .map((oracle) => oracleIdToMlIndex(oracle))
          .filter((index): index is number => index !== null && index !== undefined),
      ),
    ];
    const inputTensor = tensor(vector);

    const encoded = encoder.predict(inputTensor) as any;
    const result = deckbuilderDecoder.predict([encoded]) as any;
    return result.dataSync();
  });

  const res = [];

  for (const oracle of allOracles) {
    const index = oracleIdToMlIndex(oracle);

    if (index === null || index === undefined) {
      continue;
    }

    if (oracles.includes(oracle)) {
      res.push({
        oracle,
        rating: array[index] ?? 0,
      });
    }
  }

  return res.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
};

/**
 * Batched version of draft() — encodes all N seat pools in one TF forward pass
 * instead of N sequential passes. Returns rated pack cards per seat.
 */
export const draftBatch = (packs: string[][], pools: string[][]): { oracle: string; rating: number }[][] => {
  if (!encoder || !draftDecoder || packs.length === 0) return packs.map(() => []);

  const batchVector = pools.map((pool) =>
    encodeIndeces(pool.map((oracle) => oracleToIndex[oracle]).filter((index): index is number => index !== undefined)),
  );

  // Single batched forward pass: [N, numOracles] → encoder → draftDecoder → [N, numOracles]
  const flatResult: number[] = tidy(() => {
    const inputTensor = tensor(batchVector); // [N, numOracles]
    const encoded = encoder.predict(inputTensor) as any; // [N, encodingDim]
    const result = draftDecoder.predict([encoded]) as any; // [N, numOracles]
    return Array.from(result.dataSync() as Float32Array);
  });

  return packs.map((pack, i) => {
    const rowOffset = i * numOracles;
    const packEntries = pack
      .map((oracle) => {
        const index = oracleIdToMlIndex(oracle);
        return index === null || index === undefined
          ? null
          : { oracle, index, raw: flatResult[rowOffset + index] ?? 0 };
      })
      .filter((entry): entry is { oracle: string; index: number; raw: number } => entry !== null);

    if (packEntries.length === 0) return [];

    const softmaxed = softmax(packEntries.map((entry) => entry.raw));

    return packEntries
      .map((entry, idx) => ({ oracle: entry.oracle, rating: softmaxed[idx] ?? 0 }))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  });
};

export const draft = (pack: string[], pool: string[], cubeContext?: number[]) => {
  if (!encoder || !draftDecoder) {
    return [];
  }

  const cubeCtxVec =
    cubeContext && cubeContext.length === CUBE_CONTEXT_DIM ? cubeContext : new Array(CUBE_CONTEXT_DIM).fill(0);

  const array = tidy(() => {
    const vector = [
      encodeIndeces(
        pool.map((oracle) => oracleToIndex[oracle]).filter((index): index is number => index !== undefined),
      ),
    ];
    const inputTensor = tensor(vector);
    const encoded = encoder.predict(inputTensor) as any;
    const cubeCtxTensor = tensor([cubeCtxVec]);
    const combined = concat([encoded, cubeCtxTensor], -1);
    const result = draftDecoder.predict([combined]) as any;
    return result.dataSync();
  });
  const allOracles = getAllOracleIds();

  const packVector = encodeIndeces(
    pack
      .map((oracle) => oracleIdToMlIndex(oracle))
      .filter((index): index is number => index !== null && index !== undefined),
  );
  const mask = packVector.map((x) => 1e9 * (1 - x));

  const softmaxed = softmax(array.map((x: number, i: number) => x * packVector[i] - (mask[i] ?? 0)));

  const res = [];

  for (const oracle of allOracles) {
    const index = oracleIdToMlIndex(oracle);

    if (index === null || index === undefined) {
      continue;
    }

    if (pack.includes(oracle)) {
      res.push({
        oracle,
        rating: softmaxed[index] ?? 0,
      });
    }
  }

  return res.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
};

export const batchDraft = (
  inputs: { pack: string[]; pool: string[]; cubeContext?: number[] }[],
): { oracle: string; rating: number }[][] => {
  if (!encoder || !draftDecoder || inputs.length === 0) {
    return inputs.map(() => []);
  }

  // Build a batched input tensor [N, numOracles] for all pools at once
  const vectors = inputs.map((input) =>
    encodeIndeces(
      input.pool.map((oracle) => oracleToIndex[oracle]).filter((index): index is number => index !== undefined),
    ),
  );

  const cubeCtxVectors = inputs.map((input) =>
    input.cubeContext && input.cubeContext.length === CUBE_CONTEXT_DIM
      ? input.cubeContext
      : new Array(CUBE_CONTEXT_DIM).fill(0),
  );

  // Single forward pass through encoder + decoder for all inputs
  const batchedArray = tidy(() => {
    const inputTensor = tensor(vectors);
    const encoded = encoder.predict(inputTensor) as any;
    const cubeCtxTensor = tensor(cubeCtxVectors);
    const combined = concat([encoded, cubeCtxTensor], -1);
    const result = draftDecoder.predict([combined]) as any;
    return result.arraySync();
  });

  const allOracles = getAllOracleIds();

  // Post-process each result individually (pack masking + softmax)
  return inputs.map((input, batchIdx) => {
    const array = batchedArray[batchIdx];

    const packVector = encodeIndeces(
      input.pack
        .map((oracle) => oracleIdToMlIndex(oracle))
        .filter((index): index is number => index !== null && index !== undefined),
    );
    const mask = packVector.map((x) => 1e9 * (1 - x));

    const softmaxed = softmax(array.map((x: number, i: number) => x * packVector[i] - (mask[i] ?? 0)));

    const res = [];
    for (const oracle of allOracles) {
      const index = oracleIdToMlIndex(oracle);
      if (index === null || index === undefined) continue;
      if (input.pack.includes(oracle)) {
        res.push({ oracle, rating: softmaxed[index] ?? 0 });
      }
    }
    return res.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  });
};

export const batchBuild = (inputs: string[][]): { oracle: string; rating: number }[][] => {
  if (!encoder || !deckbuilderDecoder || inputs.length === 0) {
    return inputs.map(() => []);
  }

  const allOracles = getAllOracleIds();

  // Build a batched input tensor [N, numOracles] for all pools at once
  const vectors = inputs.map((oracles) =>
    encodeIndeces(
      oracles
        .map((oracle) => oracleIdToMlIndex(oracle))
        .filter((index): index is number => index !== null && index !== undefined),
    ),
  );

  // Single forward pass through encoder + decoder for all inputs
  const batchedArray: number[][] = tidy(() => {
    const inputTensor = tensor(vectors);
    const encoded = encoder.predict(inputTensor) as any;
    const result = deckbuilderDecoder.predict([encoded]) as any;
    return result.arraySync();
  });

  // Post-process each result: filter to only oracles present in the input pool
  return inputs.map((oracles, batchIdx) => {
    const array = batchedArray[batchIdx];
    if (!array) return [];
    const res: { oracle: string; rating: number }[] = [];

    for (const oracle of allOracles) {
      const index = oracleIdToMlIndex(oracle);
      if (index === null || index === undefined) continue;
      if (oracles.includes(oracle)) {
        res.push({ oracle, rating: array[index] ?? 0 });
      }
    }

    return res.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  });
};

export const oracleInData = (oracle: string): boolean => {
  return oracleToIndex[oracle] !== undefined;
};
