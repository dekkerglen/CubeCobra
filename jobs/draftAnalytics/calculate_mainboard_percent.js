const fs = require('fs');
const glob = require('glob');

const cardToInt = require('../export/cardToInt.json');

const intToCard = Object.fromEntries(Object.entries(cardToInt).map(([key, value]) => [value, key]));

const mainboardCount = Object.fromEntries(Object.keys(intToCard).map((k) => [k, 0]));
const draftedCount = Object.fromEntries(Object.keys(intToCard).map((k) => [k, 0]));

const BASICS = ['plains', 'island', 'swamp', 'mountain', 'forest'];

const draftFiles = glob.sync('jobs/export/drafts/*.json');
for (const draftFile of draftFiles) {
  console.log(draftFile);
  const drafts = JSON.parse(fs.readFileSync(draftFile));
  for (const draft of drafts) {
    if (draft.sideboard.length > 0) {
      for (const card of draft.main) {
        if (!BASICS.includes(intToCard[card])) {
          mainboardCount[card] += 1;
          draftedCount[card] += 1;
        }
      }
      for (const card of draft.sideboard) {
        if (!BASICS.includes(intToCard[card])) {
          draftedCount[card] += 1;
        }
      }
    }
  }
}

const mainboardPercent = Object.fromEntries(
  Object.entries(intToCard)
    .filter(([k]) => draftedCount[k] > 0)
    .map(([k, name]) => [name, mainboardCount[k] / draftedCount[k]]),
);

fs.writeFileSync('jobs/export/mainboardPercent.json', JSON.stringify(mainboardPercent), 'utf8');

const padToLength = (value, fixedAmount, length) => {
  const valueFixed = value.toFixed(fixedAmount);
  const valueSpacing = new Array(length - valueFixed.length).fill(' ').join('');
  return `${valueSpacing}${valueFixed}`;
};

const outputLine = (name, value, numerator, denominator) =>
  `${name}:${new Array(28 - name.length).fill(' ').join('')} ${padToLength(value, 3, 5)} = ${padToLength(
    numerator,
    3,
    9,
  )} / ${padToLength(denominator, 3, 9)}`;

const sortedValues = Object.entries(mainboardPercent)
  .filter(([name]) => draftedCount[cardToInt[name]] > 99)
  .sort(([, value], [, value2]) => value2 - value);

console.log('Best Cards:');
console.log(
  sortedValues
    .slice(0, 25)
    .map(([name, value]) => outputLine(name, value, mainboardCount[cardToInt[name]], draftedCount[cardToInt[name]]))
    .join('\n'),
);
console.log('\nWorst Cards:');
console.log(
  sortedValues
    .slice(sortedValues.length - 25, sortedValues.length)
    .map(([name, value]) => outputLine(name, value, mainboardCount[cardToInt[name]], draftedCount[cardToInt[name]]))
    .join('\n'),
);
