let mongoose = require('mongoose');

// Cube schema
let draftSchema = mongoose.Schema(
  {
    picks:[[]],
    packs:[[[]]],
    activepacks:[[]],
    cube:String,
    numPacks:Number,
    numCards:Number,
    numSeats:Number
  }
);

let Draft = module.exports = mongoose.model('Draft',draftSchema)
