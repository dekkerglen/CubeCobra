// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/user');

const username = 'Ashok';

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    const user = await User.findOne({ email: 'kresseljakob@gmail.com' });

    user.email = user.email.toLowerCase();

    await user.save();

    console.log(user);

    console.log('done');
    process.exit();
  });
})();
