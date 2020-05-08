let mongoose = require('mongoose');
let cardSchema = require('./cardSchema');

//data for each seat, human or bot
const Seat = {
  bot: [String], //null bot value means human player
  name: String,
  userid: String,
  drafted: [[Number]], //organized draft picks
  sideboard: [[Number]], //organized draft picks
  pickorder: [Number],
  packbacklog: [[Number]],
};

// Cube schema
let draftSchema = mongoose.Schema({
  cube: String,
  initial_state: [[[Number]]],
  seats: [Seat],
  unopenedPacks: [[[Number]]],
  cards: [cardSchema],
  synergies: [[Number]],
});

let Draft = (module.exports = mongoose.model('Draft', draftSchema));
