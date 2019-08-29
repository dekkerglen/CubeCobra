let mongoose = require('mongoose');

// Cube schema
let blogSchema = mongoose.Schema({
  title: String,
  body: String,
  owner: String,
  date: Date,
  cube: String,
  html: String,
  dev: String,
  date_formatted: String,
  changelist: String
});

let Blog = module.exports = mongoose.model('Blog', blogSchema)