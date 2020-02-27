async function tagCloud(cards) {
  const tags = {};
  cards.forEach((card) =>
    card.tags.forEach((tag) => {
      if (tags[tag]) {
        tags[tag].asfan += card.asfan;
        tags[tag].count += 1;
      } else {
        tags[tag] = { asfan: card.asfan, count: 1, tag, key: tag };
      }
    }),
  );
  const rows = Object.keys(tags)
    .map((tag) => ({
      tag,
      asfan: tags[tag].asfan.toFixed(2),
      key: tag,
      count: tags[tag].count,
    }))
    .sort((a, b) => b.asfan - a.asfan);
  return {
    type: 'table',
    description:
      'Tags in your cube with random colors weighted by the expected number of cards with that tag a player will open on average.',
    tables: [
      {
        columns: [
          { header: 'Tag', key: 'tag', rowHeader: true },
          { header: 'Expected Opened', key: 'asfan' },
          { header: 'Count', key: 'count' },
        ],
        rows,
      },
    ],
  };
}

export default tagCloud;
