let mongoose = require('mongoose');

// Cube schema
let cardSchema = mongoose.Schema(
  {
    id:String,
    name:String,
    image_small:String,
    image_normal:String,
    art_crop:String,
    colors:[String],
    cmc:Number,
    type:String
  }
);

let Card = module.exports = mongoose.model('Card',cardSchema)
