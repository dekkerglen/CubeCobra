const fs = require('fs');
const glob = require('glob');

// eslint-disable-next-line import/no-unresolved
const cardToInt = require('../export/cardToInt.json');

const intToCard = Object.fromEntries(Object.entries(cardToInt).map(([key, value]) => [value, key]));

const pickPosition = Object.fromEntries(Object.keys(intToCard).map((k) => [k, 0]));
const pickCount = Object.fromEntries(Object.keys(intToCard).map((k) => [k, 0]));

const draftFiles = glob.sync('jobs/export/drafts/*.json');
for (const draftFile of draftFiles) {
  console.log(draftFile);
  const drafts = JSON.parse(fs.readFileSync(draftFile));
  for (const draft of drafts) {
    for (const pick of draft.picks) {
      pickPosition[pick.chosenCard] += pick.pick / pick.packSize;
      pickCount[pick.chosenCard] += 1;
    }
  }
}

const averagePickPosition = Object.fromEntries(
  Object.entries(intToCard)
    .filter(([k]) => pickCount[k] > 0)
    .map(([k, name]) => [name, (15 * pickPosition[k]) / pickCount[k] + 1]),
);
const pickCounts = Object.fromEntries(Object.entries(intToCard).map(([k, name]) => [name, pickCount[k]]));

fs.writeFileSync('jobs/export/averagePickPositions.json', JSON.stringify(averagePickPosition), 'utf8');
fs.writeFileSync('jobs/export/pickCounts.json', JSON.stringify(pickCounts), 'utf8');

const padToLength = (value, fixedAmount, length) => {
  const valueFixed = value.toFixed(fixedAmount);
  const valueSpacing = new Array(length - valueFixed.length).fill(' ').join('');
  return `${valueSpacing}${valueFixed}`;
};

const outputLine = (name, value, numerator, denominator) =>
  `${name}:${new Array(28 - name.length).fill(' ').join('')} ${padToLength(value, 3, 6)} = ${padToLength(
    numerator,
    3,
    9,
  )} / ${padToLength(denominator, 3, 9)}`;

const sortedPositions = Object.entries(averagePickPosition)
  .filter(([name]) => pickCount[cardToInt[name]] > 99)
  .sort(([, position], [, position2]) => position - position2);
console.log('Best Cards');
console.log(
  sortedPositions
    .slice(0, 25)
    .map(([name, value]) =>
      outputLine(
        name,
        value,
        15 * pickPosition[cardToInt[name]] + pickCount[cardToInt[name]],
        pickCount[cardToInt[name]],
      ),
    )
    .join('\n'),
);
console.log('\nWorst Cards:');
console.log(
  sortedPositions
    .slice(sortedPositions.length - 25, sortedPositions.length)
    .map(([name, value]) =>
      outputLine(
        name,
        value,
        15 * pickPosition[cardToInt[name]] + pickCount[cardToInt[name]],
        pickCount[cardToInt[name]],
      ),
    )
    .join('\n'),
);
