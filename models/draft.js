let mongoose = require('mongoose');
let cardSchema = require('./cardSchema');

//data for each seat, human or bot
const Seat = {
  bot: [String], //null bot value means human player
  name: String,
  userid: String,
  drafted: [[cardSchema]], //organized draft picks
  sideboard: [[cardSchema]], //organized draft picks
  pickorder: [cardSchema],
  packbacklog: [[cardSchema]],
  description: String
};

// Cube schema
let draftSchema = mongoose.Schema({
  cube: String,
  deck: String,
  finished: {
    type: Boolean,
    default: false
  },
  initial_state: [[[cardSchema]]],

  //new format, will convert to
  seats: [Seat],
  unopenedPacks: [[[cardSchema]]],

  //deprecated
  picks: [[]],
  packs: [[[]]],
  bots: [[]],
  pickOrder: [],
  pickNumber: Number,
  packNumber: Number,
});

let Draft = (module.exports = mongoose.model('Draft', draftSchema));
