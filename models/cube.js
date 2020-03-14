const mongoose = require('mongoose');

const Card = {
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
};

// Cube schema
const cubeSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true,
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
  overrideCategory: {
    type: Boolean,
    default: false,
  },
  categoryOverride: {
    type: String,
    default: 'Vintage',
  },
  categoryPrefixes: {
    type: [String],
    default: [],
  },
  tags: {
    type: [String],
    default: [],
  },
  cards: {
    type: [Card],
    default: [],
  },
  maybe: {
    type: [Card],
    default: [],
  },
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
  date_updated: {
    type: Date,
    index: true,
  },
  updated_string: String,
  default_sorts: [String],
  card_count: Number,
  type: String,
  draft_formats: {
    type: [
      {
        title: String,
        multiples: Boolean,
        html: String,
        packs: String,
      },
    ],
    default: [],
  },
  users_following: {
    type: [String],
    default: [],
  },
  defaultStatus: {
    type: String,
    default: 'Owned',
  },
  defaultPrinting: {
    type: String,
    // Values: first, recent
    default: 'recent',
  },
});

const Cube = mongoose.model('Cube', cubeSchema);

Cube.LAYOUT_FIELDS = '_id owner name type card_count overrideCategory categoryOverride categoryPrefixes';
Cube.PREVIEW_FIELDS =
  '_id shortId urlAlias name card_count type overrideCategory categoryOverride categoryPrefixes image_name image_artist image_uri owner owner_name';

module.exports = Cube;
