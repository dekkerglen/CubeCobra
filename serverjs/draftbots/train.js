const tf = require('@tensorflow/tfjs-node');
const createModel = require('./model');
const createDataset = require('./dataset');
const { trainPortion, batchSize, epochs, savePath } = require('./constants');

/**
 * Train a model with dataset, then save the model to a local folder.
 */
async function run() {
  const data = await createDataset(1);
  const model = createModel(data.numberOfHeuristics);

  // Split dataset into 2 groups, one for training, one for validation
  const trainBatches = Math.floor((trainPortion * data.dataset.length) / batchSize);
  const dataset = data.dataset.shuffle(1000).batch(batchSize);
  const trainDataset = dataset.take(trainBatches);
  const validationDataset = dataset.skip(trainBatches);

  try {
    await model.fitDataset(trainDataset, { epochs, validationData: validationDataset });
    await model.save(savePath);
  } catch (err) {
    console.error(err);
  }

  // const loadedModel = await tf.loadLayersModel(`${savePath}/model.json`);
  process.exit();
}

run();
