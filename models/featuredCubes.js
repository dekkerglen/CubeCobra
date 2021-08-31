const mongoose = require('mongoose');

const featuredCubesSchema = mongoose.Schema({
  // the actual queue, represented as an array
  // elements at 0 and 1 are currently featured cubes
  queue: [
    {
      cubeID: mongoose.Schema.Types.ObjectId,
      ownerID: mongoose.Schema.Types.ObjectId,
    },
  ],
  // time when the queue was last rotated.
  lastRotation: Date,
  // how many days should pass between each rotation
  daysBetweenRotations: {
    type: Number,
    default: 14,
  },

  // logical timestamp used for concurrency control (see util.updateFeatured)
  timestamp: {
    type: Number,
    default: 0,
    unique: true, // unique index required to ensure updates are atomic
  },

  // singleton marker; only one queue should ever exist
  singleton: {
    type: Boolean,
    default: true,
    unique: true,
  },
});

const FeaturedCubes = mongoose.model('FeaturedCubes', featuredCubesSchema);
// simplified getter for operations not requiring an update
FeaturedCubes.getSingleton = function getSingleton() {
  return FeaturedCubes.findOne({ singleton: true }).lean();
};

FeaturedCubes.on('index', async () => {
  // startup method that creates the singleton if it doesn't exist
  // runs only after indices are built to guarantee atomicity
  const query = { singleton: true };
  const options = { upsert: true, setDefaultsOnInsert: true };
  await FeaturedCubes.findOneAndUpdate(query, {}, options);
});

module.exports = FeaturedCubes;
