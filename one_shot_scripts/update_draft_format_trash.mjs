import dotenv from 'dotenv';
import mongoose from 'mongoose';

// eslint-disable-next-line import/extensions
import Draft from '../models/draft.js';

dotenv.config();

const batchSize = 100;

const mapPack = (pack) => {
  if (pack.trash) {
    return pack;
  }
  return { trash: 0, cards: pack };
};

const migrateDraft = async (draft) => {
  if (draft.initial_state[0]?.[0]?.trash) {
    return null;
  }
  draft.initial_state = draft.initial_state.map((packs) => packs.map(mapPack));
  draft.unopenedPacks = draft.unopenedPacks.map((packs) => packs.map(mapPack));
  draft.seats = draft.seats.map((seat) => ({
    ...seat,
    packbacklog: seat.packbacklog.map(mapPack),
  }));
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
