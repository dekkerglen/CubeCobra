module.exports = {
  tags: [
    {
      type: String,
      minlength: 1,
    },
  ],
  finish: {
    type: String,
    default: 'Non-foil',
    enum: ['Foil', 'Non-foil'],
  },
  status: {
    type: String,
    default: 'Not Owned',
    enum: ['Not Owned', 'Ordered', 'Owned', 'Premium Owned', 'Proxied'],
  },
  colors: {
    type: [{ type: String, enum: ['W', 'U', 'B', 'R', 'G', 'C'] }],
    default: null,
  },
  cmc: {
    type: Number,
    min: 0,
    default: null,
  },
  cardID: String,
  type_line: {
    type: String,
    default: null,
  },
  rarity: {
    type: String,
    default: null,
  },
  addedTmsp: Date,
  imgUrl: String,
  imgBackUrl: String,
  notes: String,
  index: {
    type: Number,
    default: null,
  },
  colorCategory: {
    type: String,
    default: null,
  },
};
