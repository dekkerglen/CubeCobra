/* eslint-disable no-console */
// Load Environment Variables
require('dotenv').config();

const { updatePodcast } = require('../util/podcast');
const Content = require('../dynamo/models/content');
import { ContentStatus, ContentType } from '../datatypes/Content';

const tryUpdate = async (podcast) => {
  try {
    await updatePodcast(podcast);
  } catch (err) {
    console.error(`Failed to update podcast: ${podcast.title}`, { error: err });
  }
};

const run = async () => {
  const podcasts = await Content.getByTypeAndStatus(ContentType.PODCAST, ContentStatus.PUBLISHED);

  console.log({ message: 'Updating podcasts...' });

  for (const podcast of podcasts.items) {
    await tryUpdate(podcast);
  }

  console.log({ message: 'Finished updating podcasts.' });

  // this is needed for log group to stream
  await new Promise((resolve) => {
    setTimeout(resolve, 10000);
  });

  process.exit();
};

run();
