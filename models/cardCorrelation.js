let mongoose = require('mongoose');

// card schema for analytics only. Use card objects for most use cases
let cardCorrelationSchema = mongoose.Schema({
  cardName: {
    type: String,
    index: true,
    unique: true,
  },
  correlation: {
    type: {},
    default: {}
  }
}, {
  strict: false
});

let CardCorrelation = (module.exports = mongoose.model('CardCorrelation', cardCorrelationSchema));
