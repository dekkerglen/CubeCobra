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
    articles: [String],
    drafts:[{
      user:String,
      draftid:String
    }]
  }
);

let Cube = module.exports = mongoose.model('Cube',cubeSchema)
