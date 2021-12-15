// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const { getFeedData } = require('../serverjs/rss');

const Podcast = require('../models/podcast');
const Episode = require('../models/podcastEpisode');

const pairs = [
  {
    id: '6074f7f902527b1074bc3c2c',
    image:
      'https://ssl-static.libsyn.com/p/assets/5/0/5/c/505c99166ea3132cbafc7308ab683e82/172718695_205204854385141_4136278207625330166_n.png',
  },
  {
    id: '5fbcd33bc2955d1042243d1c',
    image: 'https://mtgcast-images.s3.amazonaws.com/20fa33be35-cubechaos.png',
  },
];

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    for (const { id, image } of pairs) {
      const podcast = await Podcast.findById(id);

      podcast.image = image;

      await podcast.save();

      const episodes = await Episode.find({ podcast: podcast._id });

      await Promise.all(
        episodes.map(async (episode) => {
          episode.image = image;
          return episode.save();
        }),
      );
    }

    process.exit();
  });
})();
