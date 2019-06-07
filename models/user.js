const mongoose = require('mongoose');

// User schema
const UserSchema = mongoose.Schema({
  username:
  {
    type: String,
    required: true
  },
  password:
  {
    type: String,
    required: true
  },
  email:
  {
    type: String,
    required: true
  },
  confirmed:
  {
    type: String,
    required: true
  },
  about:
  {
    type: String,
    required: false
  }
});

const User = module.exports = mongoose.model('User', UserSchema);
