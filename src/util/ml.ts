import { getAllOracleIds, isOracleBasic } from './carddb';

const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const cloudwatch = require('./cloudwatch');

const { getOracleForMl, getReasonableCardByOracle } = require('./carddb');

const indexToOracle = JSON.parse(fs.readFileSync('./model/indexToOracleMap.json'));
const oracleToIndex = Object.fromEntries(Object.entries(indexToOracle).map(([key, value]) => [value, key]));

const numOracles = Object.keys(oracleToIndex).length;

interface Model {
  predict: (arg0: any) => { (): any; new (): any; dataSync: { (): any; new (): any } };
}

let encoder: Model;
let recommendDecoder: Model;
let deckbuilderDecoder: Model;
let draftDecoder: Model;

tf.loadGraphModel('file://./model/encoder/model.json')
  .then((model: Model) => {
    encoder = model;
    // eslint-disable-next-line no-console
    console.info('encoder loaded');
  })
  .catch((err: { message: any; stack: any }) => {
    cloudwatch.error(err.message, err.stack);
  });

tf.loadGraphModel('file://./model/cube_decoder/model.json')
  .then((model: Model) => {
    recommendDecoder = model;
    // eslint-disable-next-line no-console
    console.info('recommend_decoder loaded');
  })
  .catch((err: { message: any; stack: any }) => {
    cloudwatch.error(err.message, err.stack);
  });

tf.loadGraphModel('file://./model/deck_build_decoder/model.json')
  .then((model: Model) => {
    deckbuilderDecoder = model;
    // eslint-disable-next-line no-console
    console.info('deck_build_decoder loaded');
  })
  .catch((err: { message: any; stack: any }) => {
    cloudwatch.error(err.message, err.stack);
  });

tf.loadGraphModel('file://./model/draft_decoder/model.json')
  .then((model: Model) => {
    draftDecoder = model;
    // eslint-disable-next-line no-console
    console.info('draft_decoder loaded');
  })
  .catch((err: { message: any; stack: any }) => {
    cloudwatch.error(err.message, err.stack);
  });

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

  const vector = [encodeIndeces(oracles.map((oracle) => oracleToIndex[oracle]))];

  return tf.tidy(() => {
    const tensor = tf.tensor(vector);
    return encoder.predict(tensor).dataSync();
  });
};

const oracleIdToMlIndex = (oracleId: string) => {
  const oracleIndex = oracleToIndex[oracleId];

  if (oracleIndex !== undefined) {
    return oracleIndex;
  }

  const card = getReasonableCardByOracle(oracleId);

  if (card.cubeCount < 50 || card.isToken || isOracleBasic(oracleId)) {
    return null;
  }

  const subOracle = getOracleForMl(oracleId);

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

  const vector = [encodeIndeces(oracles.map((oracle) => oracleIdToMlIndex(oracle)))];

  const array = tf.tidy(() => {
    const tensor = tf.tensor(vector);
    const encoded = encoder.predict(tensor);

    return recommendDecoder.predict([encoded]).dataSync();
  });

  const res = [];

  for (const oracle of allOracles) {
    const index = oracleIdToMlIndex(oracle);

    if (index === null) {
      continue;
    }

    res.push({
      oracle,
      rating: array[index],
    });
  }

  const oracleSet = new Set(oracles);
  const adds: { oracle: string; rating: number }[] = [];
  const cuts: { oracle: string; rating: number }[] = [];

  res
    .sort((a, b) => b.rating - a.rating)
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

  const array = tf.tidy(() => {
    const vector = [encodeIndeces(oracles.map((oracle) => oracleIdToMlIndex(oracle)))];
    const tensor = tf.tensor(vector);

    const encoded = encoder.predict(tensor);
    return deckbuilderDecoder.predict([encoded]).dataSync();
  });

  const res = [];

  for (const oracle of allOracles) {
    const index = oracleIdToMlIndex(oracle);

    if (oracles.includes(oracle)) {
      res.push({
        oracle,
        rating: array[index],
      });
    }
  }

  return res.sort((a, b) => b.rating - a.rating);
};

export const draft = (pack: string[], pool: string[]) => {
  const array = tf.tidy(() => {
    const vector = [encodeIndeces(pool.map((oracle) => oracleToIndex[oracle]))];
    const tensor = tf.tensor(vector);
    const encoded = encoder.predict(tensor);
    return draftDecoder.predict([encoded]).dataSync();
  });
  const allOracles = getAllOracleIds();

  const packVector = encodeIndeces(pack.map((oracle) => oracleIdToMlIndex(oracle)));
  const mask = packVector.map((x) => 1e9 * (1 - x));

  const softmaxed = softmax(array.map((x: number, i: number) => x * packVector[i] - mask[i]));

  const res = [];

  for (const oracle of allOracles) {
    const index = oracleIdToMlIndex(oracle);

    if (index === null) {
      continue;
    }

    if (pack.includes(oracle)) {
      res.push({
        oracle,
        rating: softmaxed[index],
      });
    }
  }

  return res.sort((a, b) => b.rating - a.rating);
};

export const oracleInData = (oracle: string) => {
  return oracleToIndex[oracle] !== undefined;
};
