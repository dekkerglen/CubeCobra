const mongoose = require('mongoose');

// User schema
const UserSchema = mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  username_lower: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  confirmed: {
    type: String,
    required: true
  },
  about: {
    type: String,
    required: false
  },
  hide_tag_colors: {
    type: Boolean,
    default: false
  },
  edit_token: String,  
  followed_cubes: {
    type: [String],
    default: []
  },  
  followed_users: {
    type: [String],
    default: []
  },  
  users_following: {
    type: [String],
    default: []
  }
});

const User = module.exports = mongoose.model('User', UserSchema);