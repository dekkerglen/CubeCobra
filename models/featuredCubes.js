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

  singleton: {
    type: Boolean,
    default: true,
    unique: true,
  },
});

const FeaturedCubes = mongoose.model('FeaturedCubes', featuredCubesSchema);

module.exports = FeaturedCubes;
