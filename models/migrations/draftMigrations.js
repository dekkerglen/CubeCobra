const { migration } = require('@baethon/mongoose-lazy-migration');

const dedupeCardObjects = (draft) => {
  if (!draft) return null;
  if (draft.cards && draft.cards.length > 0) return draft;

  const defaultPack = { filters: [], trash: 0, sealed: false, picksPerPass: 1 };

  const replaceWithIndex = (card) => draft.cards.findIndex((card2) => card && card2 && card.cardID === card2.cardID);
  const mapPacks = (packs) =>
    (packs || []).map((pack) => ({ ...defaultPack, cards: (pack || []).map(replaceWithIndex) }));
  const mapSeats = (seats) => (seats || []).map(mapPacks);
  const replace1d = (arr) => (arr || []).map(replaceWithIndex);
  const replace2d = (arr) => (arr || []).map(replace1d);

  draft.cards = (draft.initial_state || [])
    .flat(3)
    .concat(Object.values(draft.basics || {}))
    .map((card, index) => ({ ...card, index }));
  draft.initial_state = mapSeats(draft.initial_state);
  draft.unopenedPacks = mapSeats(draft.unopenedPacks);
  draft.seats = (draft.seats || []).map((seat) => {
    seat.drafted = replace2d(seat.drafted);
    seat.sideboard = replace2d(seat.sideboard);
    seat.packbacklog = mapPacks(seat.packbacklog);
    seat.pickorder = replace1d(seat.pickorder);
    return seat;
  });
  return draft;
};

const migrations = [migration(1, dedupeCardObjects)];

module.exports = migrations;
