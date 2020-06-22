const mongoose = require('mongoose');

// User schema
const PasswordResetSchema = mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  expires: {
    type: Date,
    required: false,
  },
  code: {
    type: String,
    required: true,
  },
});

PasswordResetSchema.index({
  code: 1,
  email: 1,
});

const PasswordReset = (module.exports = mongoose.model('PasswordReset', PasswordResetSchema));
