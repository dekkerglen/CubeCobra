module.exports = {
  addedTmsp: Date,
  cardID: String,
  cmc: {
    type: Number,
    min: 0,
    default: null,
  },
  colorCategory: {
    type: String,
    default: null,
  },
  colors: {
    type: [{ type: String, enum: ['W', 'U', 'B', 'R', 'G', 'C'] }],
    default: void 0, // eslint-disable-line
  },
  finish: {
    type: String,
    default: 'Non-foil',
    enum: ['Foil', 'Non-foil'],
  },
  imgBackUrl: String,
  imgUrl: String,
  index: {
    type: Number,
    default: null,
  },
  isUnlimited: {
    type: Boolean,
    default: false,
  },
  notes: String,
  rarity: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    default: 'Not Owned',
    enum: ['Not Owned', 'Ordered', 'Owned', 'Premium Owned', 'Proxied'],
  },
  tags: [
    {
      type: String,
      minlength: 1,
    },
  ],
  type_line: {
    type: String,
    default: null,
  },
};
