module.exports = {
  tags: [
    {
      type: String,
      minlength: 1,
    },
  ],
  finish: {
    type: String,
    enum: ['Foil', 'Non-foil'],
    default: 'Non-foil',
  },
  status: {
    type: String,
    enum: ['Not Owned', 'Ordered', 'Owned', 'Premium Owned', 'Proxied'],
    default: 'Not Owned',
  },
  colors: {
    type: [
      {
        type: String,
        enum: ['W', 'U', 'B', 'R', 'G', 'C', ''],
      },
    ],
    default: null,
  },
  cmc: {
    type: Number,
    min: 0,
    default: null,
  },
  cardID: String,
  type_line: String,
  rarity: {
    type: String,
    default: null,
  },
  addedTmsp: Date,
  imgUrl: String,
  notes: String,
  picks: {
    type: [[Number]],
    default: [],
  },
  passed: {
    type: Number,
    default: 0,
  },
  index: Number,
  rating: Number,
  colorCategory: {
    type: String,
    enum: [null, 'White', 'Blue', 'Black', 'Red', 'Green', 'Hybrid', 'Multicolored', 'Colorless', 'Lands'],
    default: null,
  },
};
