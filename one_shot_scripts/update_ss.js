// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');

const Podcast = require('../models/podcast');
const Episode = require('../models/podcastEpisode');

const newRss = 'https://solelysingletonmtg.libsyn.com/rss';

const ssId = '5f5e405852b3261056b62466';

const poorhammersEps = [
  '6136aef9722701a7c8325254',
  '61526975e3aceba7d1db927b',
  '615b9580df19b8fa5c5f39c6',
  '6164e48a6985012d680f0857',
  '617740faa1fc3c9f42d873f4',
  '6189bc666494c6f34907d703',
  '61930586292c1540f68a7379',
  '61a5880c0e6ce5522045e0ff',
  '61aeb8b776123d4adfd5413f',
  '61c135bedac8ab18ee29cb4e',
  '61e621ccc012318adea28ab6',
  '61ef6c3ee9fead9a09f4449b',
  '6201bc49baa3b9aaa508d71b',
  '621452910b06e9066ae5bd6c',
  '6226d50671c1f476e1ef5f9e',
];

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    const podcast = await Podcast.findById(ssId);
    podcast.rss = newRss;
    await podcast.save();

    for (const id of poorhammersEps) {
      await Episode.deleteOne({ _id: mongoose.Types.ObjectId(id) });
    }

    process.exit();
  });
})();
