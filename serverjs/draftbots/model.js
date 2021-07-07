const tf = require('@tensorflow/tfjs-node');
const { maxPackSize } = require('./constants');

function createModel(numberOfHeuristics) {
  const model = tf.sequential({
    layers: [
      tf.layers.permute({
        inputShape: [maxPackSize, numberOfHeuristics],
        dims: [2, 1],
      }),
      tf.layers.conv1d({
        kernelSize: [numberOfHeuristics],
        filters: 4,
        activation: 'relu',
      }),
      tf.layers.dense({ units: maxPackSize, activation: 'softmax' }),
    ],
  });

  model.compile({ optimizer: tf.train.sgd(0.01), loss: 'categoricalCrossentropy' });
  return model;
}

module.exports = createModel;
