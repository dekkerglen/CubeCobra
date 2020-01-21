let mongoose = require('mongoose');

//data for each seat, human or bot
const Seat = {
  bot: [], //null bot value means human player
  name: String,
  userId: String,
  drafted: [[]], //organized draft picks
  pickOrder: [],
};

// Cube schema
let draftSchema = mongoose.Schema({
  cube: String,
  ratings: {},
  initial_state: [[[]]],
  
  //new format, will convert to
  seats: [Seat],

  //deprecated
  picks: [[]],
  packs: [[[]]],
  bots: [[]],
  pickOrder: [],
  pickNumber: Number,
  packNumber: Number,
});

let Draft = (module.exports = mongoose.model('Draft', draftSchema));
