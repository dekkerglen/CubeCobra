let mongoose = require('mongoose');

// Cube schema
let cubeSchema = mongoose.Schema(
  {
    name:
    {
      type: String,
      required: true
    },
    owner:
    {
      type: String,
      required: true
    },
    cards: [String],
    decks: [String],
    description:String,
    image_uri:String,
    image_artist:String,
    image_name:String
  }
);

let Cube = module.exports = mongoose.model('Cube',cubeSchema)
