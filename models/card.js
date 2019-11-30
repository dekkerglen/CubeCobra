let mongoose = require('mongoose');

// card schema for analytics only. Use card objects for most use cases
let cardSchema = mongoose.Schema({
  cardName: {
    type: String,
    index: true
  },
  cubeTypeCount:{
    //fencepost values are < and >, respectively
    //these values are a tuple of: [value, percent]
    type: { 
      size180: [Number],
      size360: [Number],
      size450: [Number],
      size540: [Number],
      size720: [Number],
      pauper: [Number],
      legacy: [Number],
      modern: [Number],
      standard: [Number],
      vintage: [Number],
      total: [Number]
    }
  },
  cubedWith: [[String]], //this is list of card ids
  draftedWith: [String], //this is a list of card ids
  similarCards: [String], //this is a list of card ids
  cubes:[String], //this is a list of cube ids
  decks:[String] //this is a list of deck ids
});

let Card = (module.exports = mongoose.model('Card', cardSchema));
