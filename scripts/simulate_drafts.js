// You must disable CSRF protection to run this script
const fetch = require('node-fetch');
// eslint-disable-next-line import/no-extraneous-dependencies
const FormData = require('form-data');

const Card = require('../dist/utils/Card');
const Draft = require('../dist/utils/Draft');
const draftutil = require('../dist/utils/draftutil');

const getDraft = async () => {
  const body = new FormData();
  body.append('packs', 3);
  body.append('cards', 15);
  body.append('seats', 8);
  body.append('botsOnly', 'on');
  body.append('id', -1);
  const response = await fetch(`http://127.0.0.1:5000/cube/startdraft/${process.argv[2]}`, {
    method: 'post',
    headers: body.getHeaders(),
    body,
  });
  const { draft } = await response.json();
  return draft;
};

const runDraft = async () => {
  const draft = await getDraft();
  Draft.default.init(draft);
  Draft.default.allBotsDraft(true);
  const colorCounts = [];
  const landCounts = [];
  const nonlandCounts = [];
  const totalCounts = [];
  for (const seat of draft.seats) {
    // eslint-disable-next-line no-await-in-loop
    const { colors } = await Draft.default.buildDeck(seat.pickorder, draft.basics);
    const nonlands = seat.pickorder.filter((c) => !Card.cardType(c).toLowerCase().includes('land'));
    const lands = seat.pickorder.filter((c) => Card.cardType(c).toLowerCase().includes('land'));
    const nonlandsInColor = nonlands.filter((c) => Draft.default.considerInCombination(colors, c));
    const landsInColor = lands.filter((c) => Draft.default.isPlayableLand(colors, c));
    colorCounts.push(colors.length);
    landCounts.push([landsInColor.length, lands.length]);
    nonlandCounts.push([nonlandsInColor.length, nonlands.length]);
    totalCounts.push([landsInColor.length + nonlandsInColor.length, seat.pickorder.length]);
  }
  const result = { colorCounts, landCounts, nonlandCounts, totalCounts };
  return result;
};

const runTest = async () => {
  const colorCounts = [];
  const landCounts = [];
  const nonlandCounts = [];
  const totalCounts = [];
  const SAMPLE_COUNT = 125;
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    // eslint-disable-next-line no-await-in-loop
    const result = await runDraft();
    colorCounts.push(...result.colorCounts);
    landCounts.push(...result.landCounts);
    nonlandCounts.push(...result.nonlandCounts);
    totalCounts.push(...result.totalCounts);
    console.log(`Finished draft ${i + 1} of ${SAMPLE_COUNT}`);
  }
  console.log(
    'Colors average:',
    draftutil.weightedAverage(colorCounts.map((c) => [1, c])).toFixed(2),
    'stddev:',
    draftutil.weightedStdDev(colorCounts.map((c) => [1, c])).toFixed(2),
    'percentiles:',
    draftutil.weightedPercentiles(
      colorCounts.map((c) => [1, c]),
      9,
    ),
  );
  console.log(
    'Land average:',
    draftutil.weightedAverage(landCounts.map(([c]) => [1, c])).toFixed(2),
    'stddev:',
    draftutil.weightedStdDev(landCounts.map(([c]) => [1, c])).toFixed(2),
    'percentiles:',
    draftutil.weightedPercentiles(
      landCounts.map(([c]) => [1, c]),
      9,
    ),
  );
  console.log(
    'Nonland average:',
    draftutil.weightedAverage(nonlandCounts.map(([c]) => [1, c])).toFixed(2),
    'stddev:',
    draftutil.weightedStdDev(nonlandCounts.map(([c]) => [1, c])).toFixed(2),
    'percentiles:',
    draftutil.weightedPercentiles(
      nonlandCounts.map(([c]) => [1, c]),
      9,
    ),
  );
  console.log(
    'Total average:',
    draftutil.weightedAverage(totalCounts.map(([c]) => [1, c])).toFixed(2),
    'stddev:',
    draftutil.weightedStdDev(totalCounts.map(([c]) => [1, c])).toFixed(2),
    'percentiles:',
    draftutil.weightedPercentiles(
      totalCounts.map(([c]) => [1, c]),
      9,
    ),
  );
};

runTest();
