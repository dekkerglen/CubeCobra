// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/user');
const Patron = require('../models/patron');

const username = 'dekkerglen';

const level = 'Cobra Hatchling';

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    const user = await User.findOne({ username });

    const patron = await Patron.findOne({ user: user._id });

    if (patron) {
      patron.active = true;
      patron.level = level;

      await patron.save();
    } else {
      const newPatron = new Patron();
      newPatron.email = user.email;
      newPatron.user = user._id;
      newPatron.level = level;
      newPatron.active = true;

      await newPatron.save();
    }

    console.log('done');
    process.exit();
  });
})();
