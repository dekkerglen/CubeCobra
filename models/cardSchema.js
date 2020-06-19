module.exports = {
  tags: [String],
  finish: {
    type: String,
    enum: ['Foil', 'Non-foil'],
  },
  colors: [{ type: String, enum: ['W', 'U', 'B', 'R', 'G', 'C'] }],
  status: {
    type: String,
    enum: ['Not Owned', 'Ordered', 'Owned', 'Premium Owned', 'Proxied'],
  },
  cmc: Number,
  cardID: String,
  elo: Number,
  type_line: String,
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
};
