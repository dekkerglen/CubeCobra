const fs = require('fs');
const glob = require('glob');

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
    const lastPick = draft.picks[draft.picks.length - 1];
    for (const card of lastPick.seen) {
      seen[card] += 1;
    }
  }
}

const scarcities = Object.fromEntries(
  Object.entries(intToCard)
    .map(([k, name]) => {
      if (inDraft[k] === 0) {
        return null;
      }
      return [name, seen[k] / inDraft[k]];
    })
    .filter((p) => p !== null),
);

fs.writeFileSync('jobs/export/scarcities.json', JSON.stringify(scarcities), 'utf8');
