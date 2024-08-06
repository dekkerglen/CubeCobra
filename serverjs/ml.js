const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const cloudwatch = require('./cloudwatch');

const indexToOracle = JSON.parse(fs.readFileSync('./model/indexToOracleMap.json'));
const oracleToIndex = Object.fromEntries(Object.entries(indexToOracle).map(([key, value]) => [value, key]));

const numOracles = Object.keys(oracleToIndex).length;

let encoder;
let recommendDecoder;
let deckbuilderDecoder;
let draftDecoder;

tf.loadGraphModel('file://./model/encoder/model.json')
  .then((model) => {
    encoder = model;
    // eslint-disable-next-line no-console
    console.info('encoder loaded');
  })
  .catch((err) => {
    cloudwatch.error(err.message, err.stack);
  });

tf.loadGraphModel('file://./model/cube_decoder/model.json')
  .then((model) => {
    recommendDecoder = model;
    // eslint-disable-next-line no-console
    console.info('recommend_decoder loaded');
  })
  .catch((err) => {
    cloudwatch.error(err.message, err.stack);
  });

tf.loadGraphModel('file://./model/deck_build_decoder/model.json')
  .then((model) => {
    deckbuilderDecoder = model;
    // eslint-disable-next-line no-console
    console.info('deck_build_decoder loaded');
  })
  .catch((err) => {
    cloudwatch.error(err.message, err.stack);
  });

tf.loadGraphModel('file://./model/draft_decoder/model.json')
  .then((model) => {
    draftDecoder = model;
    // eslint-disable-next-line no-console
    console.info('draft_decoder loaded');
  })
  .catch((err) => {
    cloudwatch.error(err.message, err.stack);
  });

const softmax = (array) => {
  const max = Math.max(...array);
  const exps = array.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((value) => value / sum);
};

const encodeIndeces = (indeces) => {
  const tensor = new Array(numOracles).fill(0);

  indeces.forEach((index) => {
    tensor[index] = 1;
  });

  return tensor;
};

const encode = (oracles) => {
  if (!encoder) {
    return [];
  }

  const vector = [encodeIndeces(oracles.map((oracle) => oracleToIndex[oracle]))];

  return tf.tidy(() => {
    const tensor = tf.tensor(vector);
    return encoder.predict(tensor).dataSync();
  });
};

const recommend = (oracles) => {
  if (!encoder || !recommendDecoder) {
    return {
      adds: [],
      removes: [],
    };
  }

  const vector = [encodeIndeces(oracles.map((oracle) => oracleToIndex[oracle]))];

  const array = tf.tidy(() => {
    const tensor = tf.tensor(vector);
    const encoded = encoder.predict(tensor);

    return recommendDecoder.predict([encoded]).dataSync();
  });

  const res = [];

  for (let i = 0; i < numOracles; i++) {
    res.push({
      oracle: indexToOracle[i],
      rating: array[i],
    });
  }

  const adds = res.sort((a, b) => b.rating - a.rating).filter((card) => !oracles.includes(card.oracle));
  const cuts = res.sort((a, b) => a.rating - b.rating).filter((card) => oracles.includes(card.oracle));

  return {
    adds,
    cuts,
  };
};

const build = (oracles) => {
  if (!encoder || !deckbuilderDecoder) {
    return {
      mainboard: [],
      sideboard: [],
    };
  }

  const array = tf.tidy(() => {
    const vector = [encodeIndeces(oracles.map((oracle) => oracleToIndex[oracle]))];
    const tensor = tf.tensor(vector);

    const encoded = encoder.predict(tensor);
    return deckbuilderDecoder.predict([encoded]).dataSync();
  });

  const res = [];

  for (let i = 0; i < numOracles; i++) {
    const oracle = indexToOracle[i];

    if (oracles.includes(oracle)) {
      res.push({
        oracle: indexToOracle[i],
        rating: array[i],
      });
    }
  }

  return res.sort((a, b) => b.rating - a.rating);
};

const draft = (pack, pool) => {
  const array = tf.tidy(() => {
    const vector = [encodeIndeces(pool.map((oracle) => oracleToIndex[oracle]))];
    const tensor = tf.tensor(vector);
    const encoded = encoder.predict(tensor);
    return draftDecoder.predict([encoded]).dataSync();
  });

  const packVector = encodeIndeces(pack.map((oracle) => oracleToIndex[oracle]));
  const mask = packVector.map((x) => 1e9 * (1 - x));

  const softmaxed = softmax(array.map((x, i) => x * packVector[i] - mask[i]));

  const res = [];

  for (let i = 0; i < numOracles; i++) {
    const oracle = indexToOracle[i];
    if (pack.includes(oracle)) {
      res.push({
        oracle: indexToOracle[i],
        rating: softmaxed[i],
      });
    }
  }

  return res.sort((a, b) => b.rating - a.rating);
};

module.exports = {
  recommend,
  build,
  draft,
  encode,
};
