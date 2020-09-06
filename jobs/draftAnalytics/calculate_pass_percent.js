const fs = require('fs');
const glob = require('glob');

const cardToInt = require('../export/cardToInt.json');

const intToCard = Object.fromEntries(Object.entries(cardToInt).map(([key, value]) => [value, key]));

const pickedOverCount = Object.fromEntries(Object.keys(intToCard).map((k) => [k, 0]));
const pickCount = Object.fromEntries(Object.keys(intToCard).map((k) => [k, 0]));
const seenCount = Object.fromEntries(Object.keys(intToCard).map((k) => [k, 0]));
const inPackWhenSeenCount = Object.fromEntries(Object.keys(intToCard).map((k) => [k, 0]));

const draftFiles = glob.sync('jobs/export/drafts/*.json');
for (const draftFile of draftFiles) {
  console.log(draftFile);
  const drafts = JSON.parse(fs.readFileSync(draftFile));
  for (const draft of drafts) {
    for (const pick of draft.picks) {
      for (const card of pick.cardsInPack) {
        seenCount[card] += 1;
        inPackWhenSeenCount[card] += pick.cardsInPack.length / pick.packSize;
      }
      pickCount[pick.chosenCard] += 1;
      pickedOverCount[pick.chosenCard] += (pick.cardsInPack.length - 1) / pick.packSize;
    }
  }
}

const passPercents = Object.fromEntries(
  Object.entries(intToCard)
    .filter(([k]) => seenCount[k] > 0)
    .map(([k, name]) => [name, 1 - pickCount[k] / seenCount[k]]),
);
const pickedOverCounts = Object.fromEntries(
  Object.entries(intToCard)
    .filter(([k]) => seenCount[k] > 0)
    .map(([k, name]) => [name, (15 * pickedOverCount[k]) / pickCount[k]]),
);
const inPackWhenSeenCounts = Object.fromEntries(
  Object.entries(intToCard)
    .filter(([k]) => seenCount[k] > 0)
    .map(([k, name]) => [name, (15 * inPackWhenSeenCount[k]) / seenCount[k]]),
);
const seenCounts = Object.fromEntries(Object.entries(intToCard).map(([k, name]) => [name, seenCount[k]]));
const normalizedPickedOver = Object.fromEntries(
  Object.entries(pickedOverCounts).map(([name, value]) => [name, value / (1 - passPercents[name])]),
);

fs.writeFileSync('jobs/export/passPercents.json', JSON.stringify(passPercents), 'utf8');
fs.writeFileSync('jobs/export/pickedOverCounts.json', JSON.stringify(pickedOverCounts), 'utf8');
fs.writeFileSync('jobs/export/seenCounts.json', JSON.stringify(seenCounts), 'utf8');
fs.writeFileSync('jobs/export/inPackWhenSeenCounts.json', JSON.stringify(inPackWhenSeenCounts), 'utf8');
fs.writeFileSync('jobs/export/normalizedPickedOver.json', JSON.stringify(normalizedPickedOver), 'utf8');

const padToLength = (value, fixedAmount, length) => {
  const valueFixed = value.toFixed(fixedAmount);
  const valueSpacing = new Array(length - valueFixed.length).fill(' ').join('');
  return `${valueSpacing}${valueFixed}`;
};

const outputLine = (name, value, numerator, denominator) =>
  `${name}:${new Array(28 - name.length).fill(' ').join('')} ${padToLength(value, 3, 10)} = ${padToLength(
    numerator,
    3,
    10,
  )} / ${padToLength(denominator, 3, 10)}`;

const sortedPositions = Object.entries(passPercents)
  .filter(([name]) => seenCount[cardToInt[name]] > 99)
  .sort(([, position], [, position2]) => position - position2);
console.log('Best Cards');
console.log(
  sortedPositions
    .slice(0, 25)
    .map(([name, value]) =>
      outputLine(name, value, seenCount[cardToInt[name]] - pickCount[cardToInt[name]], seenCount[cardToInt[name]]),
    )
    .join('\n'),
);
console.log('\nWorst Cards:');
console.log(
  sortedPositions
    .slice(sortedPositions.length - 25, sortedPositions.length)
    .map(([name, value]) =>
      outputLine(name, value, seenCount[cardToInt[name]] - pickCount[cardToInt[name]], seenCount[cardToInt[name]]),
    )
    .join('\n'),
);
const sortedPickedOver = Object.entries(pickedOverCounts)
  .filter(([name]) => seenCount[cardToInt[name]] > 99)
  .sort(([, position], [, position2]) => position2 - position);
console.log('\nBest Cards');
console.log(
  sortedPickedOver
    .slice(0, 25)
    .map(([name, value]) => outputLine(name, value, 15 * pickedOverCount[cardToInt[name]], seenCount[cardToInt[name]]))
    .join('\n'),
);
console.log('\nWorst Cards:');
console.log(
  sortedPickedOver
    .slice(sortedPickedOver.length - 25, sortedPickedOver.length)
    .map(([name, value]) => outputLine(name, value, 15 * pickedOverCount[cardToInt[name]], seenCount[cardToInt[name]]))
    .join('\n'),
);
const sortedInPackWhenSeen = Object.entries(inPackWhenSeenCounts)
  .filter(([name]) => seenCount[cardToInt[name]] > 99)
  .sort(([, position], [, position2]) => position2 - position);
console.log('\nBest Cards');
console.log(
  sortedInPackWhenSeen
    .slice(0, 25)
    .map(([name, value]) => outputLine(name, value, inPackWhenSeenCount[cardToInt[name]], seenCount[cardToInt[name]]))
    .join('\n'),
);
console.log('\nWorst Cards:');
console.log(
  sortedInPackWhenSeen
    .slice(sortedInPackWhenSeen.length - 25, sortedInPackWhenSeen.length)
    .map(([name, value]) => outputLine(name, value, inPackWhenSeenCount[cardToInt[name]], seenCount[cardToInt[name]]))
    .join('\n'),
);
const sortedNormalizedPickOrder = Object.entries(normalizedPickedOver)
  .filter(([name]) => seenCount[cardToInt[name]] > 99)
  .sort(([, position], [, position2]) => position2 - position);
console.log('\nBest Cards');
console.log(
  sortedNormalizedPickOrder
    .slice(0, 25)
    .map(([name, value]) => outputLine(name, value, pickedOverCounts[name], passPercents[name]))
    .join('\n'),
);
console.log('\nWorst Cards:');
console.log(
  sortedNormalizedPickOrder
    .slice(sortedNormalizedPickOrder.length - 25, sortedNormalizedPickOrder.length)
    .map(([name, value]) => outputLine(name, value, pickedOverCounts[name], passPercents[name]))
    .join('\n'),
);
