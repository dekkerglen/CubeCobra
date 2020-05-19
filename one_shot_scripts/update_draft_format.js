require('dotenv').config();

const mongoose = require('mongoose');
const Draft = require('../models/draft');

const batchSize = 100;

const migrateDraft = async (draft) => {
  if (draft.cards) {
    return null;
  }
  const cards = draft.initial_state.flat(3);
  draft.cards = cards;
  const replaceWithIndex = (card) => cards.findIndex((card2) => card && card2 && card.cardID === card2.cardID);
  draft.initial_state = draft.initial_state.map((seat) => seat.map((pack) => pack.map(replaceWithIndex)));
  draft.unopenedPacks = draft.initial_state.map((seat) => seat.map((pack) => pack.map(replaceWithIndex)));
  draft.seats = draft.seats.map((seat) => {
    seat.drafted = (seat.drafted || []).map((pack) => pack.map(replaceWithIndex));
    seat.sideboard = (seat.sideboard || []).map((pack) => pack.map(replaceWithIndex));
    seat.packbacklog = (seat.packbacklog || []).map((pack) => pack.map(replaceWithIndex));
    seat.pickorder = (seat.pickorder || []).map(replaceWithIndex);
    return seat;
  });
  return draft;
};

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    const count = await Draft.countDocuments();
    const cursor = Draft.find().lean().cursor();
    for (let i = 0; i < count; i += batchSize) {
      const drafts = [];
      for (let j = 0; j < batchSize; j++) {
        if (i + j < count) {
          // eslint-disable-next-line no-await-in-loop
          const draft = await cursor.next();
          if (draft) {
            drafts.push(migrateDraft(draft));
          }
        }
      }
      // eslint-disable-next-line no-await-in-loop
      const operations = (await Promise.all(drafts))
        .filter((draft) => draft)
        .map((draft) => ({
          replaceOne: {
            filter: { _id: draft._id },
            replacement: draft,
          },
        }));
      if (operations.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await Draft.bulkWrite(operations);
      }
      console.log(`Finished: ${i + batchSize} of ${count} drafts`);
    }

    mongoose.disconnect();
    console.log('done');
  });
})();
