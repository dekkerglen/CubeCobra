const fs = require('fs');
const glob = require('glob');

// eslint-disable-next-line import/no-unresolved
const cardToInt = require('../export/cardToInt.json');

const intToCard = Object.fromEntries(Object.entries(cardToInt).map(([key, value]) => [value, key]));

const inDraft = Object.fromEntries(Object.keys(intToCard).map((k) => [k, 0]));
const seen = Object.fromEntries(Object.keys(intToCard).map((k) => [k, 0]));

const draftFiles = glob.sync('jobs/export/drafts/*.json');
for (const draftFile of draftFiles) {
  console.log(draftFile);
  const drafts = JSON.parse(fs.readFileSync(draftFile));
  for (const draft of drafts) {
    for (const card of draft.cards) {
      inDraft[card] += 1;
    }
    let numPacks = 0;
    for (const pick of draft.picks) {
      if (pick.pick === 0) {
        numPacks += 1;
      }
    }
    const lastPick = draft.picks[draft.picks.length - 1];
    for (const card of lastPick.seen) {
      seen[card] += 15 / (draft.picks.length / numPacks);
    }
  }
}

const scarcities = Object.fromEntries(
  Object.entries(intToCard)
    .filter(([k]) => inDraft[k] > 0)
    .map(([k, name]) => [name, seen[k] / inDraft[k]]),
);
const inDraftCounts = Object.fromEntries(Object.entries(intToCard).map(([k, name]) => [name, inDraft[k]]));

fs.writeFileSync('jobs/export/scarcities.json', JSON.stringify(scarcities), 'utf8');
fs.writeFileSync('jobs/export/inDraftCounts.json', JSON.stringify(inDraftCounts), 'utf8');

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

const sortedScarcities = Object.entries(scarcities)
  .filter(([name]) => inDraft[cardToInt[name]] > 999)
  .sort(([, scarcity], [, scarcity2]) => scarcity - scarcity2);
console.log('Best Cards');
console.log(
  sortedScarcities
    .slice(0, 25)
    .map(([name, scarcity]) => outputLine(name, scarcity, seen[cardToInt[name]], inDraft[cardToInt[name]]))
    .join('\n'),
);
console.log('\nWorst Cards:');
console.log(
  sortedScarcities
    .slice(sortedScarcities.length - 25, sortedScarcities.length)
    .map(([name, scarcity]) => outputLine(name, scarcity, seen[cardToInt[name]], inDraft[cardToInt[name]]))
    .join('\n'),
);
