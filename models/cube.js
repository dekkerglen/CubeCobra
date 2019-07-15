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
    cards: [{
      tags:[String],
      status:String,
      colors:[String],
      cmc:Number,
      cardID:String,
      details:{}
    }],
    decks: [String],
    numDecks:Number,
    description:String,
    image_uri:String,
    image_artist:String,
    image_name:String,
    owner_name:String,
    date_updated:Date,
    updated_string:String
  }
);

let Cube = module.exports = mongoose.model('Cube',cubeSchema)
