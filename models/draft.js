let mongoose = require('mongoose');

// Cube schema
let draftSchema = mongoose.Schema(
  {
    picks:[[]],
    packs:[[[]]],
    cube:String,
    bots:[[]],
    pickNumber:Number,
    packNumber:Number,
    ratings:{}
  }
);

let Draft = module.exports = mongoose.model('Draft',draftSchema)
