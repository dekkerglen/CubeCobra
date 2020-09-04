export const getPackAsSeen = (initialState, index, deck, seatIndex) => {
  const cardsInPack = [];

  let start = 0;
  let end = initialState[0][0].length;
  let pack = 0;
  let current = parseInt(seatIndex, 10);
  let picks = parseInt(index, 10);

  while (picks >= initialState[0][pack].length) {
    start = end;
    end += initialState[0][pack].length;
    picks -= initialState[0][pack].length;
    pack += 1;
  }

  for (let i = start + picks; i < end; i += 1) {
    cardsInPack.push(deck.seats[current].pickorder[i]);
    if (pack % 2 !== initialState[0].length % 2) {
      current += 1;
      current %= initialState.length;
    } else {
      current -= 1;
      if (current < 0) {
        current = initialState.length - 1;
      }
    }
  }

  // establish list of picks sepearted by packs
  const seat = deck.seats[seatIndex];
  const picksList = [];
  let ind = 0;
  let added = 0;
  for (const list of initialState[0]) {
    picksList.push(seat.pickorder.slice(added, added + list.length).map((c) => ({ ...c })));
    added += list.length;
  }
  for (const list of picksList) {
    for (const card of list) {
      card.index = ind;
      ind += 1;
    }
  }

  return [cardsInPack, picks, pack, picksList, seat];
};

export default { getPackAsSeen };
