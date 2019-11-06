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
  updated: Boolean
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