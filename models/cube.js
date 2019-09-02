let mongoose = require('mongoose');

// Cube schema
let cubeSchema = mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  shortID: {
    type: String,
    required: true,
    index: true
  },
  urlAlias: {
    type: String,
    index: true
  },
  owner: {
    type: String,
    required: true
  },
  isListed: {
    type: Boolean,
    default: true
  },
  cards: [{
    tags: [String],
    status: String,
    colors: [String],
    cmc: Number,
    cardID: String,
    type_line: String,
    addedTmsp: Date,
    details: {}
  }],
  decks: [String],
  numDecks: Number,
  description: String,
  descriptionhtml: String,
  image_uri: String,
  image_artist: String,
  image_name: String,
  owner_name: String,
  date_updated: Date,
  updated_string: String,
  default_sorts: [String],
  card_count: Number,
  type: String,
  draft_formats: {}
});

let Cube = module.exports = mongoose.model('Cube', cubeSchema)