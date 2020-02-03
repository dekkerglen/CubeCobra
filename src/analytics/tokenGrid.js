const compareCards = (x, y) => {
  if (x.details.name === y.details.name) {
    return 0;
  }
  return x.details.name < y.details.name ? -1 : 1;
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

function tokenGrid(cards) {
  const mentionedTokens = [];
  cards.forEach((card, position) => {
    card.position = position;
    if (card.details.tokens) {
      mentionedTokens.push(...card.details.tokens.map(({ token }) => ({ token, sourceCard: { ...card } })));
    }
  });

  const resultingTokens = [];
  mentionedTokens.forEach((element) => {
    const relevantIndex = resultingTokens.findIndex(({ token }) => token.cardID === element.token.cardID);
    if (relevantIndex >= 0) {
      resultingTokens[relevantIndex].related.push(element.sourceCard);
    } else {
      resultingTokens.push({ token: element.token, related: [element.sourceCard] });
    }
  });
  const data = sortTokens(resultingTokens).map(({ token, related }) => ({
    card: token,
    cardDescription: sortCards(dedupeCards(related))
      .map(({ position }) => `[[${position}]]`)
      .join('\n\n'),
  }));
  return {
    type: 'cardGrid',
    description: 'All the tokens and emblems your cube uses and what cards require each of them.',
    massBuyLabel: 'Buy all tokens',
    cards: data,
  };
}

export default tokenGrid;
