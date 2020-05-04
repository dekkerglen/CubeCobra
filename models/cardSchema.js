module.exports = {
  tags: [String],
  finish: {
    type: String,
    enum: ['Foil', 'Non-foil'],
  },
  colors: [{ type: String, enum: ['W', 'U', 'B', 'R', 'G'] }],
  status: {
    type: String,
    enum: ['Not Owned', 'Ordered', 'Owned', 'Premium Owned', 'Proxied'],
  },
  cmc: Number,
  cardID: String,
  type_line: String,
  imgUrl: String,
  notes: String,
  rating: Number,
};
