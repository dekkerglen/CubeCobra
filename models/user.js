const mongoose = require('mongoose');

// User schema
const UserSchema = mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  username_lower: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  confirmed: {
    type: String,
    required: true,
  },
  about: {
    type: String,
    required: false,
  },
  hide_tag_colors: {
    type: Boolean,
    default: false,
  },
  edit_token: String,
  followed_cubes: {
    type: [String],
    default: [],
  },
  followed_users: {
    type: [String],
    default: [],
  },
  users_following: {
    type: [String],
    default: [],
  },
  notifications: {
    type: [
      {
        user_from: String,
        user_from_name: String,
        url: String,
        date: Date,
        text: String,
      },
    ],
    default: [],
  },
  old_notifications: {
    type: [
      {
        user_from: String,
        user_from_name: String,
        url: String,
        date: Date,
        text: String,
      },
    ],
    default: [],
  },
  image_name: {
    type: String,
    default: 'Ambush Viper',
  },
  image: {
    type: String,
    default: 'https://img.scryfall.com/cards/art_crop/front/0/c/0c082aa8-bf7f-47f2-baf8-43ad253fd7d7.jpg?1562826021',
  },
  artist: {
    type: String,
    default: 'Allan Pollack',
  },
});

UserSchema.index({
  username_lower: 1,
});

UserSchema.index({
  email: 1,
});

module.exports = mongoose.model('User', UserSchema);
