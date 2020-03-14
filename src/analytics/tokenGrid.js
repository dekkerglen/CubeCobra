const compareCards = (x, y) => x.details.name.localeCompare(y.details.name);
const sortCards = (cards) => [...cards].sort(compareCards);

const dedupeCards = (cards) => {
  const map = new Map(cards.map((card) => [card.details.name, card]));
  return [...map.values()];
};

function tokenGrid(cards) {
  const positioned = cards.map((card, index) => ({ ...card, position: index }));
  const byTokenId = {};
  for (const card of positioned) {
    for (const token of card.details.tokens || []) {
      if (!byTokenId[token.cardID]) {
        byTokenId[token.cardID] = {
          token,
          cards: [],
        };
      }
      byTokenId[token.cardID].cards.push(card);
    }
  }

  const sorted = [...Object.entries(byTokenId)];
  sorted.sort((x, y) => compareCards(x[1].token, y[1].token));
  const data = sorted.map(([, tokenData]) => ({
    card: tokenData.token,
    cardDescription: sortCards(dedupeCards(tokenData.cards))
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
