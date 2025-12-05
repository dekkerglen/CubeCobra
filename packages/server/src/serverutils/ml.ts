import { type GraphModel, loadGraphModel, tensor, tidy } from '@tensorflow/tfjs-node';
import { readFileSync } from 'fs';
import path from 'path';

import 'dotenv/config';

import { getAllOracleIds, getOracleForMl, getReasonableCardByOracle, isOracleBasic } from './carddb';
import { error } from './cloudwatch';

let indexToOracle: Record<number, string> = {};
let oracleToIndex: Record<string, number> = {};
let numOracles = 0;

let encoder: GraphModel;
let recommendDecoder: GraphModel;
let deckbuilderDecoder: GraphModel;
let draftDecoder: GraphModel;

const errorHandler = (modelName: string, err: { message: any; stack: any }) => {
  if (process.env?.NODE_ENV === 'development') {
    console.warn(`${modelName} not found, bot stuff will not work as expected`);
  } else {
    error(err.message, err.stack);
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
  ];

  await Promise.allSettled(modelPromises);
  console.info('Finished loading ML models.');
}

/**
 * Helper for waiting until all ML models to be loaded before proceeding.
 * Useful when running something that uses the ML via a script
 * @param timeout Maximum time to wait in milliseconds (default: 30000)
 * @returns Promise that resolves when all models are loaded, rejects on timeout
 */
export const ensureModelsReady = (timeout = 30000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const checkModels = () => {
      return encoder && recommendDecoder && deckbuilderDecoder && draftDecoder;
    };

    // Check immediately
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

const oracleIdToMlIndex = (oracleId: string) => {
  const oracleIndex = oracleToIndex[oracleId];

  if (oracleIndex !== undefined) {
    return oracleIndex;
  }

  const card = getReasonableCardByOracle(oracleId);

  if ((card.cubeCount ?? 0) < 50 || card.isToken || isOracleBasic(oracleId)) {
    return null;
  }

  const subOracle = getOracleForMl(oracleId, null);

  return oracleToIndex[subOracle];
};

export const recommend = (oracles: string[]) => {
  if (!encoder || !recommendDecoder) {
    return {
      adds: [],
      removes: [],
    };
  }
  const allOracles = getAllOracleIds();

  const vector = [
    encodeIndeces(
      oracles
        .map((oracle) => oracleIdToMlIndex(oracle))
        .filter((index): index is number => index !== null && index !== undefined),
    ),
  ];

  const array = tidy(() => {
    const inputTensor = tensor(vector);
    const encoded = encoder.predict(inputTensor) as any;

    const result = recommendDecoder.predict([encoded]) as any;
    return result.dataSync();
  });

  const res = [];

  for (const oracle of allOracles) {
    const index = oracleIdToMlIndex(oracle);

    if (index === null || index === undefined) {
      continue;
    }

    res.push({
      oracle,
      rating: array[index] ?? 0,
    });
  }

  const oracleSet = new Set(oracles);
  const adds: { oracle: string; rating: number }[] = [];
  const cuts: { oracle: string; rating: number }[] = [];

  res
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .forEach((card) => {
      if (oracleSet.has(card.oracle)) {
        cuts.push(card);
      } else {
        adds.push(card);
      }
    });

  cuts.reverse();

  return {
    adds,
    cuts,
  };
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

export const draft = (pack: string[], pool: string[]) => {
  if (!encoder || !draftDecoder) {
    return [];
  }

  const array = tidy(() => {
    const vector = [
      encodeIndeces(
        pool.map((oracle) => oracleToIndex[oracle]).filter((index): index is number => index !== undefined),
      ),
    ];
    const inputTensor = tensor(vector);
    const encoded = encoder.predict(inputTensor) as any;
    const result = draftDecoder.predict([encoded]) as any;
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

export const oracleInData = (oracle: string) => {
  return oracleToIndex[oracle] !== undefined;
};
