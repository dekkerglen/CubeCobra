import Content from '@server/dynamo/models/content';
import { updatePodcast } from '@server/serverutils/podcast';
import { ContentStatus, ContentType } from '@utils/datatypes/Content';

const tryUpdate = async (podcast: any) => {
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

export const syncPodcasts = async () => {
  const podcasts = await Content.getByTypeAndStatus(ContentType.PODCAST, ContentStatus.PUBLISHED);

  if (!podcasts.items || podcasts.items.length === 0) {
    console.log('No podcasts found to update.');
    return;
  }

  for (const podcast of podcasts.items) {
    await tryUpdate(podcast);
  }
};
