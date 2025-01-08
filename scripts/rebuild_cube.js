const cubeId = '63ddcf7a75838178427ea858';

const carddb = require('../util/carddb');

const ChangeLog = require('../dynamo/models/changelog');
const Cube = require('../dynamo/models/cube');

const numNull = (arr) => {
  const serialized = JSON.stringify(arr);
  const parsed = JSON.parse(serialized);

  return parsed.filter((card) => card === null).length;
};

(async () => {
  await carddb.initializeCardDb();

  const changelogs = [];

  let lastKey;
  do {
    const result = await ChangeLog.getByCube(cubeId, 10000, lastKey);

    changelogs.push(...result.items);
    lastKey = result.lastKey;
  } while (lastKey);

  // sort by date asc
  changelogs.sort((a, b) => a.date - b.date);

  const cards = {
    mainboard: [],
    maybeboard: [],
  };

  console.log(`Applying ${changelogs.length} changelogs...`);

  for (const log of changelogs) {
    const changes = log.changelog;
    const numNulls = numNull(cards.mainboard) + numNull(cards.maybeboard);

    for (const [board] of Object.entries(changes)) {
      // swaps
      if (changes[board].swaps) {
        for (const swap of changes[board].swaps) {
          cards[board][swap.index] = swap.card;
        }
      }
      // edits
      if (changes[board].edits) {
        for (const edit of changes[board].edits) {
          cards[board][edit.index] = {
            ...cards[board][edit.index],
            ...edit.newCard,
          };
        }
      }
      // removes
      if (changes[board].removes) {
        // sort removals desc
        const sorted = changes[board].removes.sort((a, b) => b.index - a.index);
        for (const remove of sorted) {
          cards[board].splice(remove.index, 1);
        }
      }
      // adds
      if (changes[board].adds) {
        for (const add of changes[board].adds) {
          cards[board].push({
            ...add,
          });
        }
      }
    }

    const numNullsAfter = numNull(cards.mainboard) + numNull(cards.maybeboard);

    if (numNulls !== numNullsAfter) {
      console.log(`Nulls changed from ${numNulls} to ${numNullsAfter}`);
    }
    console.log(`Applied changelog ${log.date}, mainboard now has ${cards.mainboard.length} cards`);
  }

  await Cube.updateCards(cubeId, cards);

  console.log('Complete');

  process.exit();
})();
