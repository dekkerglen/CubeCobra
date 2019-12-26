const mongoose = require('mongoose');

// Cube schema
const cubeSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  shortID: {
    type: String,
    required: true,
    index: true,
  },
  urlAlias: {
    type: String,
    index: true,
  },
  owner: {
    type: String,
    required: true,
    index: true,
  },
  isListed: {
    type: Boolean,
    default: true,
    index: true,
  },
  privatePrices: {
    type: Boolean,
    default: false,
  },
  isFeatured: {
    type: Boolean,
    default: false,
    index: true,
  },
  tags: {
    type: [String],
    default: [],
  },
  cards: [
    {
      tags: [String],
      finish: { type: String, default: 'Non-foil' },
      status: String,
      colors: [String],
      cmc: Number,
      cardID: String,
      type_line: String,
      addedTmsp: Date,
      imgUrl: String,
      details: {},
    },
  ],
  tag_colors: [
    {
      tag: String,
      color: String,
    },
  ],
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
  draft_formats: {},
  users_following: {
    type: [String],
    default: [],
  },
});

const Cube = (module.exports = mongoose.model('Cube', cubeSchema));
