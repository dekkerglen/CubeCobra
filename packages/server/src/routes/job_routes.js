// Load Environment Variables
require('dotenv').config();

const express = require('express');

const User = require('dynamo/models/user');
const Content = require('dynamo/models/content');
const util = require('../serverutils/util');
const fq = require('../serverutils/featuredQueue');
const { updatePodcast } = require('../serverutils/podcast');
const rotateDailyP1P1 = require('../serverutils/rotateDailyP1P1');

import { ContentStatus, ContentType } from '@utils/datatypes/Content';

const router = express.Router();

router.post('/featuredcubes/rotate', async (req, res) => {
  const { token } = req.body;

  if (token !== process.env.JOBS_TOKEN) {
    return res.status(401).send('Invalid token.');
  }

  const rotate = await fq.rotateFeatured();

  if (rotate.success === 'false') {
    return res.status(500).send('featured cube rotation failed: ' + rotate.messages.join('\n'));
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
    // eslint-disable-next-line no-console
    console.log(`Skipping inactive podcast: ${podcast.title}`);
    return;
  }

  try {
    // eslint-disable-next-line no-console
    console.log(`Updating podcast: ${podcast.title}`);
    await updatePodcast(podcast);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Failed to update podcast: ${podcast.title}`, { error: err });
  }
};

router.post('/podcasts/sync', async (req, res) => {
  const { token } = req.body;

  if (token !== process.env.JOBS_TOKEN) {
    return res.statusCode(401).send('Invalid token.');
  }

  const podcasts = await Content.getByTypeAndStatus(ContentType.PODCAST, ContentStatus.PUBLISHED);

  for (const podcast of podcasts.items) {
    await tryUpdate(podcast);
  }

  return res.status(200).send('Podcasts updated.').end();
});

router.post('/dailyp1p1/rotate', async (req, res) => {
  const { token } = req.body;

  if (token !== process.env.JOBS_TOKEN) {
    return res.status(401).send('Invalid token.');
  }

  try {
    const result = await rotateDailyP1P1();
    if (result.success) {
      return res.status(200).send('Daily P1P1 rotation completed successfully.');
    } else {
      return res.status(500).send('Daily P1P1 rotation failed.');
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Daily P1P1 rotation error:', error);
    return res.status(500).send(`Daily P1P1 rotation failed: ${error.message}`);
  }
});

module.exports = router;
