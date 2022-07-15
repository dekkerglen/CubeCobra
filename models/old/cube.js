const mongoose = require('mongoose');

const cardSchema = require('./shared/cardSchema');
const stepsSchema = require('./shared/stepsSchema');

const cubeSchema = mongoose.Schema({
  name: {
    // sort key for hashes table
    type: String,
    required: true,
  },
  ShortId: {
    // hashrow this
    type: String,
    required: true,
    unique: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  isListed: {
    // put into visibility
    type: Boolean,
    default: true,
  },
  isPrivate: {
    // put into visibility
    type: Boolean,
    default: false,
  },
  privatePrices: {
    type: Boolean,
    default: false,
  },
  isFeatured: {
    // hashrow this
    type: Boolean,
    default: false,
  },
  overrideCategory: {
    // deprecated
    type: Boolean,
    default: false,
  },
  categoryOverride: {
    // hashrow this
    type: String,
    default: 'Vintage',
  },
  categoryPrefixes: {
    // hashrow this
    type: [String],
    default: [],
  },
  cards: {
    // put in s3
    type: [cardSchema],
    default: [],
  },
  maybe: {
    // put in s3
    type: [cardSchema],
    default: [],
  },
  tag_colors: [
    {
      tag: String,
      color: String,
    },
  ],
  defaultDraftFormat: {
    type: Number,
    default: -1,
  },
  numDecks: {
    // sort key for hashes table
    type: Number,
    default: 0,
  },
  description: String,
  image_uri: String,
  image_artist: String,
  image_name: String,
  owner_name: String,
  date_updated: Date, // sort key for hashes table
  updated_string: String,
  default_sorts: [String],
  default_show_unsorted: Boolean,
  card_count: Number, // sort key for hashes table
  type: String,
  draft_formats: {
    type: [
      {
        title: String,
        multiples: Boolean,
        html: String,
        markdown: String,
        packs: [{ slots: [String], steps: stepsSchema }],
        defaultSeats: Number,
      },
    ],
    default: [],
  },
  users_following: {
    type: [mongoose.Schema.Types.ObjectId],
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
  disableNotifications: {
    type: Boolean,
    default: false,
  },
  schemaVersion: {
    type: Number,
    default() {
      return void 0; // eslint-disable-line
    },
  },
  useCubeElo: {
    type: Boolean,
    default: false,
  },
  basics: {
    type: [String],
    default: [
      '1d7dba1c-a702-43c0-8fca-e47bbad4a00f',
      '42232ea6-e31d-46a6-9f94-b2ad2416d79b',
      '19e71532-3f79-4fec-974f-b0e85c7fe701',
      '8365ab45-6d78-47ad-a6ed-282069b0fabc',
      '0c4eaecf-dd4c-45ab-9b50-2abe987d35d4',
    ],
  },
  // These fields are just for indexing
  tags: {
    // hashrow this
    type: [String],
    default: [],
  },
  cardOracles: {
    // hashrow this
    type: [String],
    default: [],
  },
  keywords: {
    // hashrow this
    type: [String],
    default: [],
  },
  categories: {
    type: [String],
    default: [],
  },
});

cubeSchema.index({
  ShortId: 1,
});

cubeSchema.index({
  isListed: 1,
  date_updated: -1,
});

cubeSchema.index({
  owner: 1,
  date_updated: -1,
});

cubeSchema.index({
  name: 1,
  date_updated: -1,
});

// these indexes are for explore queries
cubeSchema.index({
  isFeatured: 1,
});

cubeSchema.index({
  isListed: 1,
  card_count: 1,
  date_updated: -1,
});

cubeSchema.index({
  isListed: 1,
  owner: 1,
  numDecks: -1,
});

cubeSchema.index({
  schemaVersion: 1,
});

// these indexes are for searching

cubeSchema.index({
  isListed: 1,
  tags: 1,
  numDecks: -1,
  name: 1,
  date_updated: -1,
  card_count: -1,
});

cubeSchema.index({
  isListed: 1,
  cardOracles: 1,
  numDecks: -1,
  name: 1,
  date_updated: -1,
  card_count: -1,
});

cubeSchema.index({
  isListed: 1,
  keywords: 1,
  numDecks: -1,
  name: 1,
  date_updated: -1,
  card_count: -1,
});

cubeSchema.index({
  isListed: 1,
  categories: 1,
  numDecks: -1,
  name: 1,
  date_updated: -1,
  card_count: -1,
});

const Cube = mongoose.model('Cube', cubeSchema);
Cube.CURRENT_SCHEMA_VERSION = 1;
Cube.LAYOUT_FIELDS =
  '_id owner name type card_count overrideCategory categoryOverride categoryPrefixes image_uri ShortId';
Cube.PREVIEW_FIELDS =
  '_id ShortId name card_count type overrideCategory categoryOverride categoryPrefixes image_name image_artist image_uri owner owner_name image_uri';

module.exports = Cube;
