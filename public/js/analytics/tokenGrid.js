const compareCards = (x, y) => {
  if (x.details.name === y.details.name) {
    return 0;
  } else {
    return x.details.name < y.details.name ? -1 : 1;
  }
};

const compareTokens = (x, y) => compareCards(x.token, y.token);

const sortTokens = (tokens) => [...tokens].sort(compareTokens);
const sortCards = (cards) => [...cards].sort(compareCards);

const dedupeCards = (cards) => {
  const map = new Map();
  for (const card of [...cards].reverse()) {
    map.set(card.details.name, card);
  }
  return [...map.values()];
};

onmessage = (e) => {
  if (!e) return;
  const cards = e.data;

  var mentionedTokens = [];
  cards.forEach((card, position) => {
    card.position = position;
    if (card.details.tokens) {
      mentionedTokens.push(...card.details.tokens.map(({ token }) => ({ token: token, sourceCard: { ...card } })));
    }
  });

  let resultingTokens = [];
  mentionedTokens.forEach((element) => {
    var relevantIndex = resultingTokens.findIndex(({ token }) => token.cardID == element.token.cardID);
    if (relevantIndex >= 0) {
      resultingTokens[relevantIndex].cards.push(element.sourceCard);
    } else {
      var tokenData = { token: element.token, cards: [element.sourceCard] };
      resultingTokens.push(tokenData);
    }
  });
  const data = sortTokens(resultingTokens).map(({ token, cards }) => ({
    card: token,
    cardDescription: sortCards(dedupeCards(cards))
      .map(({ position }) => `[[${position}]]`)
      .join('\n\n'),
  }));
  postMessage({
    type: 'cardGrid',
    massBuyLabel: 'Buy all tokens',
    cards: data,
  });
};
