/* eslint-disable no-console */
const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const { dataPath, savePath } = require('./constants');

/**
 * Train a model with dataset, then save the model to a local folder.
 */
async function run() {
  const files = fs.readdirSync(dataPath);

  const [file] = files.splice(Math.floor(Math.random() * files.length), 1);
  console.debug(`Loading file: ${file}`);
  const points = JSON.parse(fs.readFileSync(`${dataPath}/${file}`));

  const randomPoint = points[Math.floor(Math.random() * points.length)];

  const loadedModel = await tf.loadLayersModel(`${savePath}/model.json`);

  const result = loadedModel.predict(tf.tensor3d([randomPoint.xs]));
  console.log(`Prediction:     ${result.dataSync()}`);
  console.log(`Actual:         ${randomPoint.ys}`);

  // const loadedModel = await tf.loadLayersModel(`${savePath}/model.json`);
  process.exit();
}

run();
