import { arraysEqual } from 'utils/Util';

class DraftLocation {
  constructor(type, data) {
    this.type = type;
    this.data = data;
  }

  static pack(data) {
    return new DraftLocation(DraftLocation.PACK, data);
  }

  static picks(data) {
    return new DraftLocation(DraftLocation.PICKS, data);
  }

  static deck(data) {
    return new DraftLocation(DraftLocation.DECK, data);
  }

  static sideboard(data) {
    return new DraftLocation(DraftLocation.SIDEBOARD, data);
  }

  equals(other) {
    if (this.type !== other.type) {
      return false;
    }

    if (Array.isArray(this.data) && Array.isArray(other.data)) {
      return arraysEqual(this.data, other.data);
    }

    return this.data === other.data;
  }

  toString() {
    return `DraftLocation.${this.type}(${this.data})`;
  }
}
DraftLocation.PACK = 'pack';
DraftLocation.PICKS = 'picks';
DraftLocation.DECK = 'deck';
DraftLocation.SIDEBOARD = 'sideboard';

export const moveOrAddCard = (cards, target, source) => {
  const newCards = [...cards];
  let card;
  if (Array.isArray(source)) {
    // Source is a location.
    const [sourceRow, sourceCol, sourceIndex] = source;
    newCards[sourceRow][sourceCol] = [...newCards[sourceRow][sourceCol]];
    [card] = newCards[sourceRow][sourceCol].splice(sourceIndex - 1, 1);
  } else {
    // Source is a card itself.
    card = source;
  }

  const [targetRow, targetCol, targetIndex] = target;
  if (newCards[targetRow].length < 1 + targetCol) {
    newCards[targetRow] = newCards[targetRow].concat(new Array(1 + targetCol - newCards[targetRow].length).fill([]));
  }
  newCards[targetRow][targetCol] = [...newCards[targetRow][targetCol]];
  newCards[targetRow][targetCol].splice(targetIndex, 0, card);
  return newCards;
};

export const removeCard = (cards, source) => {
  const newCards = [...cards];
  const [sourceRow, sourceCol, sourceIndex] = source;
  newCards[sourceRow][sourceCol] = [...newCards[sourceRow][sourceCol]];
  const [card] = newCards[sourceRow][sourceCol].splice(sourceIndex - 1, 1);
  return [card, newCards];
};

export default DraftLocation;
