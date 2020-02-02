onmessage = (e) => {
  if (!e) return;
  const cards = e.data;

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
  postMessage({
    type: 'cloud',
    description:
      'Tags in your cube with random colors weighted by the expected number of cards with that tag in a pool.',
    words,
  });
};
