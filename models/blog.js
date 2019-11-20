let mongoose = require('mongoose');

//this pattern lets us define comment recursively
var Comment = new mongoose.Schema();
Comment.add({
  owner: String,
  ownerName: String,
  content: String,
  index: Number,
  timePosted: Date,
  comments: [Comment],
  updated: Boolean,
  image: {
    type: String,
    default: "https://img.scryfall.com/cards/art_crop/front/0/c/0c082aa8-bf7f-47f2-baf8-43ad253fd7d7.jpg?1562826021"
  },
  artist: {
    type: String,
    default: "Allan Pollack"
  },
});

// Blog schema
let blogSchema = mongoose.Schema({
  title: String,
  body: String,
  owner: String,
  date: Date,
  cube: String,
  html: String,
  dev: String,
  date_formatted: String,
  changelist: String,
  comments: [Comment],
  username: {
    type: String,
    default: 'User'
  },
  cubename: {
    type: String,
    default: 'Cube'
  }
});


let Blog = module.exports = mongoose.model('Blog', blogSchema)