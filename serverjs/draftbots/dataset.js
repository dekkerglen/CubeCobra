/* eslint-disable no-console */
const fs = require('fs');
const tf = require('@tensorflow/tfjs-node');
const { dataPath } = require('./constants');

const { numberOfHeuristics } = require('../../dist/drafting/heuristics.js');

const createDataset = async (filesToUse) => {
  const files = fs.readdirSync(dataPath);

  filesToUse = Math.min(filesToUse, files.length);

  const data = [];
  for (let i = 0; i < filesToUse; i += 1) {
    const [file] = files.splice(Math.floor(Math.random() * files.length), 1);
    console.debug(`Loading file: ${file}`);
    const points = JSON.parse(fs.readFileSync(`${dataPath}/${file}`));
    data.push(...points);
    console.debug(`Finished loading file: ${file}, currently have ${data.length} points`);
  }

  return {
    dataset: tf.data.array(data),
    numberOfHeuristics,
  };
};

module.exports = createDataset;
