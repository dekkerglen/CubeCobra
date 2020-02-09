async function tagCloud(cards) {
  const tags = {};
  cards.forEach((card) =>
    card.tags.forEach((tag) => {
      if (tags[tag]) {
        tags[tag] += card.asfan;
      } else {
        tags[tag] = card.asfan;
      }
    }),
  );
  const words = Object.keys(tags).map((key) => ({ value: key, count: tags[key] }));
  return {
    type: 'cloud',
    description:
      'Tags in your cube with random colors weighted by the expected number of cards with that tag a player will open on average.',
    words,
  };
}

export default tagCloud;
