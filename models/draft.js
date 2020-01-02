let mongoose = require('mongoose');

// Cube schema
let draftSchema = mongoose.Schema({
  // Types are 'booster' and 'grid'.
  type: { type: String, default: 'booster' },
  picks: [[]],
  packs: [[]],
  cube: String,
  bots: [[]],
  pickOrder: [],
  pickNumber: Number,
  packNumber: Number,
  ratings: {},
  initial_state: [[[]]],
});

let Draft = (module.exports = mongoose.model('Draft', draftSchema));
