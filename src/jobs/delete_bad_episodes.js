const Content = require('../dynamo/models/content');

(async () => {
  let lastKey = null;

  let items = [];

  do {
    const result = await Content.getByTypeAndStatus(Content.TYPES.EPISODE, Content.STATUS.PUBLISHED, lastKey);
    lastKey = result.lastKey;

    // const items = result.items.filter((item) => !item.url);
    items.push(...result.items);

    // if (items.length > 0) {
    //   console.log(`Found ${items.length} bad episodes.`);

    //   await Content.batchDelete(items.map((item) => ({ id: item.id })));
    // }
  } while (lastKey);

  const episodesByPodcastGuid = {};

  items.forEach((item) => {
    if (!episodesByPodcastGuid[item.podcastGuid]) {
      episodesByPodcastGuid[item.podcastGuid] = [];
    }

    episodesByPodcastGuid[item.podcastGuid].push(item);
  });

  const episodesToDelete = [];

  for (const item of Object.keys(episodesByPodcastGuid)) {
    if (episodesByPodcastGuid[item].length > 1) {
      episodesToDelete.push(...episodesByPodcastGuid[item].slice(1));
    }
  }

  console.log(`Found ${episodesToDelete.length} bad episodes.`);

  await Content.batchDelete(episodesToDelete.map((item) => ({ id: item.id })));

  process.exit();
})();
