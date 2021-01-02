const fs = require('fs');
const glob = require('glob');

// eslint-disable-next-line import/no-unresolved
const cardToInt = require('../export/cardToInt.json');

const intToCard = Object.fromEntries(Object.entries(cardToInt).map(([key, value]) => [value, key]));

let playedFirstPickCount = 0;
let firstPickCount = 0;
const firstPickAndInMainCount = Object.fromEntries(Object.keys(intToCard).map((k) => [k, 0]));
const firstPickedCount = Object.fromEntries(Object.keys(intToCard).map((k) => [k, 0]));

const draftFiles = glob.sync('jobs/export/drafts/*.json');
for (const draftFile of draftFiles) {
  console.log(draftFile);
  const drafts = JSON.parse(fs.readFileSync(draftFile));
  for (const draft of drafts) {
    if (draft.sideboard.length > 0) {
      const firstPick = draft.picks[0].chosenCard;
      firstPickCount += 1;
      firstPickedCount[firstPick] += 1;
      if (draft.main.includes(firstPick)) {
        firstPickAndInMainCount[firstPick] += 1;
        playedFirstPickCount += 1;
      }
    }
  }
}

const playedFirstPickByCard = Object.fromEntries(
  Object.entries(intToCard)
    .filter(([k]) => firstPickedCount[k] > 0)
    .map(([k, name]) => [name, firstPickAndInMainCount[k] / firstPickedCount[k]]),
);
const playedFirstPick = {
  overall: playedFirstPickCount / firstPickCount,
  byCard: playedFirstPickByCard,
};

fs.writeFileSync('jobs/export/playedFirstPick.json', JSON.stringify(playedFirstPick), 'utf8');

const padToLength = (value, fixedAmount, length) => {
  const valueFixed = value.toFixed(fixedAmount);
  const valueSpacing = new Array(length - valueFixed.length).fill(' ').join('');
  return `${valueSpacing}${valueFixed}`;
};

const outputLine = (name, value, numerator, denominator) =>
  `${name}:${new Array(30 - name.length).fill(' ').join('')} ${padToLength(value, 3, 5)} = ${padToLength(
    numerator,
    3,
    9,
  )} / ${padToLength(denominator, 3, 9)}`;
console.log();
console.log(outputLine('Overall', playedFirstPick.overall, playedFirstPickCount, firstPickCount));
const sortedValues = Object.entries(playedFirstPickByCard)
  .filter(([name]) => firstPickedCount[cardToInt[name]] > 9)
  .sort(([, value], [, value2]) => value2 - value);

console.log('\nBest Cards:');
console.log(
  sortedValues
    .slice(0, 25)
    .map(([name, value]) =>
      outputLine(name, value, firstPickAndInMainCount[cardToInt[name]], firstPickedCount[cardToInt[name]]),
    )
    .join('\n'),
);
console.log('\nWorst Cards:');
console.log(
  sortedValues
    .slice(sortedValues.length - 25, sortedValues.length)
    .map(([name, value]) =>
      outputLine(name, value, firstPickAndInMainCount[cardToInt[name]], firstPickedCount[cardToInt[name]]),
    )
    .join('\n'),
);
