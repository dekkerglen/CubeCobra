const { migration } = require('@baethon/mongoose-lazy-migration');

const dedupeCardObjects = (gridDraft) => {
  if (!gridDraft) return null;
  if (gridDraft.cards && gridDraft.cards.length > 0) return gridDraft;

  const replaceWithIndex = (card) =>
    gridDraft.cards.findIndex((card2) => card && card2 && card.cardID === card2.cardID);
  const mapPack = (pack) => (pack || []).map(replaceWithIndex);
  const mapPacks = (packs) => (packs || []).map(mapPack);

  gridDraft.cards = (gridDraft.initial_state || [])
    .flat(2)
    .concat(Object.values(gridDraft.basics || {}))
    .map((card, index) => ({ ...card, index }));
  gridDraft.initial_state = mapPacks(gridDraft.initial_state);
  gridDraft.unopenedPacks = mapPacks(gridDraft.unopenedPacks);
  gridDraft.seats = (gridDraft.seats || []).map((seat) => {
    seat.drafted = mapPacks(seat.drafted);
    seat.sideboard = mapPacks(seat.sideboard);
    seat.pickorder = mapPack(seat.pickorder);
    return seat;
  });
  return gridDraft;
};

const migrations = [migration(1, dedupeCardObjects)];

module.exports = migrations;
