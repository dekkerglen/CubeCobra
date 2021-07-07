/* eslint-disable no-console */
const fs = require('fs');
const carddb = require('../cards.js');
const { maxPackSize } = require('./constants');
const { addCardContext, scoresArray, numberOfHeuristics } = require('../../dist/drafting/heuristics.js');
const { dataPath, rawDataPath, permutations } = require('./constants');

const swap = (arr, indexA, indexB) => {
  const temp = arr[indexA];
  arr[indexA] = arr[indexB];
  arr[indexB] = temp;
};

// creates 'count' permutations of 'point'
const permutePoint = (point, count) => {
  const res = [];

  for (let i = 0; i < count; i++) {
    const newPoint = {
      xs: point.xs.slice(),
      ys: point.ys.slice(),
    };

    for (let j = 0; j < newPoint.xs.length; j++) {
      const k = Math.floor(Math.random() * newPoint.xs.length);
      swap(newPoint.xs, j, k);
      swap(newPoint.ys, j, k);
    }

    res.push(newPoint);
  }

  return res;
};

// processes a data point into a single training data point
// point = {
//  pick: id,
//  pack: [id],
//  picked: [id],
//  seen: [id]
// }
// output should be = {
//     xs: [heuristics],
//     ys: [1,0,0,0... etc],
// }
const processPoint = (point) => {
  const pack = [point.pick].concat(point.pack);

  const datapoint = {
    ys: new Array(maxPackSize).fill(0),
  };

  // this was the actual pick
  datapoint.ys[0] = 1;
  datapoint.xs = [];

  for (const pick of pack) {
    datapoint.xs.push(
      scoresArray({
        card: pick,
        picked: point.picked,
        seen: point.seen,
      }),
    );
  }

  while (datapoint.xs.length < maxPackSize) {
    datapoint.xs.push(new Array(numberOfHeuristics).fill(0));
  }

  return datapoint;
};

const run = async () => {
  await carddb.initializeCardDb();
  addCardContext(Object.entries(carddb._carddict).map(([key, value]) => ({ cardID: key, details: value })));
  const files = fs.readdirSync(rawDataPath);

  let index = 0;
  for (const file of files) {
    console.debug(`Loading file: ${file}`);
    const points = JSON.parse(fs.readFileSync(`${rawDataPath}/${file}`));

    index += 1;
    fs.writeFileSync(
      `${dataPath}/${file}`,
      JSON.stringify(
        points
          .map(processPoint)
          .map((point) => permutePoint(point, permutations))
          .flat(),
      ),
    );
    console.debug(`Finished processing file: ${file} (${index} of ${files.length})`);
  }
  console.debug('done');
  process.exit();
};

run();
