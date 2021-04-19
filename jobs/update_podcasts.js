// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');

const { updatePodcast } = require('../serverjs/podcast');
const Podcast = require('../models/podcast');
const { winston } = require('../serverjs/cloudwatch');

const tryUpdate = async (podcast) => {
  try {
    await updatePodcast(podcast);
  } catch (err) {
    winston.error(`Failed to update podcast: ${podcast.title}`, { error: err });
  }
};
const run = async () => {
  const podcasts = await Podcast.find({ status: 'published' });

  winston.info({ message: 'Updating podcasts...' });

  await Promise.all(podcasts.map(tryUpdate));

  winston.info({ message: 'Finished updating podcasts.' });

  // this is needed for log group to stream
  await new Promise((resolve) => {
    setTimeout(resolve, 10000);
  });

  process.exit();
};

// Connect db
mongoose
  .connect(process.env.MONGODB_URL, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    run();
  });
