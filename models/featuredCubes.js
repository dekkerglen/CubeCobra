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

  timestamp: {
    type: Number,
    unique: true,
  },
  singleton: {
    type: Boolean,
    default: true,
    unique: true,
  },
});

const FeaturedCubes = mongoose.model('FeaturedCubes', featuredCubesSchema);
FeaturedCubes.getSingleton = function getSingleton() {
  return FeaturedCubes.findOne({ singleton: true }).lean();
};

module.exports = FeaturedCubes;
