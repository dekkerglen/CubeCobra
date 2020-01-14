onmessage = (e) => {
  if (!e) return;
  const cards = e.data;

  var tags = {};
  cards.forEach((card) =>
    card.tags.forEach((tag) => {
      if (tags[tag]) {
        tags[tag] += card.asfan;
      } else {
        tags[tag] = card.asfan;
      }
    }),
  );
  const words = Object.keys(tags).map((key) => {
    return { value: key, count: tags[key] };
  });
  postMessage({ type: 'cloud', words: words });
};
