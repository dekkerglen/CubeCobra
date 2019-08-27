const mongoose = require('mongoose');

// User schema
const PasswordResetSchema = mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  expires: {
    type: Date,
    required: false
  },
  code: {
    type: String,
    required: true
  }
});

const PasswordReset = module.exports = mongoose.model('PasswordReset', PasswordResetSchema);