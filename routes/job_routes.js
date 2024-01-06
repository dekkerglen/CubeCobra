/* eslint-disable no-await-in-loop */
// Load Environment Variables
require('dotenv').config();

const express = require('express');

const User = require('../dynamo/models/user');
const Content = require('../dynamo/models/content');
const FeaturedQueue = require('../dynamo/models/featuredQueue');
const util = require('../serverjs/util');
const fq = require('../serverjs/featuredQueue');
const { updatePodcast } = require('../serverjs/podcast');

const router = express.Router();

router.post('/featuredcubes/rotate', async (req, res) => {
  const { token } = req.body;

  if (token !== process.env.JOBS_TOKEN) {
    return res.statusCode(401).send('Invalid token.');
  }

  const queue = await FeaturedQueue.querySortedByDate();
  const { items } = queue;

  const rotate = await fq.rotateFeatured(items);

  if (rotate.success === 'false') {
    return res.statusCode(500).send(`featured cube rotation failed: ${rotate.messages.join('\n')}`);
  }

  const olds = await User.batchGet(rotate.removed.map((f) => f.ownerID));
  const news = await User.batchGet(rotate.added.map((f) => f.ownerID));
  const notifications = [];
  for (const old of olds) {
    notifications.push(
      util.addNotification(old, req.user, '/user/account?nav=patreon', 'Your cube is no longer featured.'),
    );
  }
  for (const newO of news) {
    notifications.push(
      util.addNotification(newO, req.user, '/user/account?nav=patreon', 'Your cube has been featured!'),
    );
  }
  await Promise.all(notifications);

  return res.status(200).send('featured cube rotation check finished successfully');
});

const tryUpdate = async (podcast) => {
  if (podcast.inactive) {
    console.log(`Skipping inactive podcast: ${podcast.title}`);
    return;
  }

  try {
    console.log(`Updating podcast: ${podcast.title}`);
    await updatePodcast(podcast);
  } catch (err) {
    console.error(`Failed to update podcast: ${podcast.title}`, { error: err });
  }
};

router.post('/podcasts/sync', async (req, res) => {
  const { token } = req.body;

  if (token !== process.env.JOBS_TOKEN) {
    return res.statusCode(401).send('Invalid token.');
  }

  const podcasts = await Content.getByTypeAndStatus(Content.TYPES.PODCAST, Content.STATUS.PUBLISHED);

  for (const podcast of podcasts.items) {
    // eslint-disable-next-line no-await-in-loop
    await tryUpdate(podcast);
  }

  return res.status(200).send('Podcasts updated.').end();
});

module.exports = router;
