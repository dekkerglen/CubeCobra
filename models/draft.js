let mongoose = require('mongoose');

// Cube schema
let draftSchema = mongoose.Schema(
  {
    picks:[[]],
    packs:[[[]]],
    activepacks:[[]],
    cube:String
  }
);

let Draft = module.exports = mongoose.model('Draft',draftSchema)
