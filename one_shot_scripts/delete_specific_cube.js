// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const Cube = require('../models/cube');

const id = '6004fb1afcf30f1047a7fe73';

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    const res = await Cube.deleteOne({ _id: id });

    console.log(res);

    console.log('done');
    process.exit();
  });
})();
