let mongoose = require('mongoose');
let cardSchema = require('./cardSchema');

// Details on each pack, how to draft and what's in it.
const Pack = {
  trash: {
    type: Number,
    default: 0,
  },
  cards: [{
    type: Number,
    min: 0,
  }],
};

//data for each seat, human or bot
const Seat = {
  bot: [String], //null bot value means human player
  name: String,
  userid: String,
  drafted: [[Number]], //organized draft picks
  sideboard: [[Number]], //organized draft picks
  pickorder: [Number],
  packbacklog: [Pack],
};

// Cube schema
let draftSchema = mongoose.Schema({
  cube: String,
  initial_state: [[Pack]],
  seats: [Seat],
  unopenedPacks: [[Pack]],
  cards: [cardSchema],
  synergies: [[Number]],
});

let Draft = (module.exports = mongoose.model('Draft', draftSchema));
