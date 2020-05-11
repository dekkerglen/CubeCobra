export const getCardsInPack = (seatIndex, index, draft, deck) => {
  const cardsInPack = [];

  let start = 0;
  let end = draft.initial_state[0][0].length;
  let pick = parseInt(index, 10);
  let pack = 0;
  let current = parseInt(seatIndex, 10);
  while (pick >= draft.initial_state[0][pack].length) {
    start = end;
    end += draft.initial_state[0][pack].length;
    pick -= draft.initial_state[0][pack].length;
    pack += 1;
  }

  for (let i = start + pick; i < end; i += 1) {
    cardsInPack.push(deck.seats[current].pickorder[i]);
    if (pack % 2 === 0) {
      current += 1;
      current %= draft.initial_state.length;
    } else {
      current -= 1;
      if (current < 0) {
        current = draft.initial_state.length - 1;
      }
    }
  }
  return { pick, pack, cardsInPack };
};

export default { getCardsInPack };
