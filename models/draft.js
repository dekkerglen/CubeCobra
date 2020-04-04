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
};

// Cube schema
let draftSchema = mongoose.Schema({
  cube: String,
  initial_state: [[[cardSchema]]],
  seats: [Seat],
  unopenedPacks: [[[cardSchema]]],
});

let Draft = (module.exports = mongoose.model('Draft', draftSchema));
