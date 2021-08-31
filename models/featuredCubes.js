const mongoose = require('mongoose');

const featuredCubesSchema = mongoose.Schema({
  queue: [
    {
      cubeID: mongoose.Schema.Types.ObjectId,
      ownerID: mongoose.Schema.Types.ObjectId,
    },
  ],
  lastRotation: Date,
  daysBetweenRotations: {
    type: Number,
    default: 14,
  },

  // logical timestamp used for concurrency control (see util.updateFeatured)
  timestamp: {
    type: Number,
    unique: true,
  },

  // singleton marker; only one queue should exist
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

module.exports = FeaturedCubes;
