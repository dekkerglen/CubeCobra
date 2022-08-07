const mongoose = require('mongoose');

const cubeAnalyticSchema = mongoose.Schema({
  cube: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  cards: {
    type: [
      {
        cardName: String,
        picks: Number,
        passes: Number,
        elo: Number,
        mainboards: Number,
        sideboards: Number,
      },
    ],
    default: [],
  },
});

cubeAnalyticSchema.index({
  cube: 1,
});

module.exports = mongoose.model('CubeAnalytic', cubeAnalyticSchema);
