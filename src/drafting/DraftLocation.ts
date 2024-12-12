import { arraysEqual } from 'utils/Util';

export type location = 'pack' | 'picks' | 'deck' | 'sideboard';

export const locations: { [key: string]: location } = {
  pack: 'pack',
  deck: 'deck',
  sideboard: 'sideboard',
};

class DraftLocation {
  type: location;
  row: number;
  col: number;
  index: number;

  constructor(type: location, row: number, col: number, index: number) {
    this.type = type;
    this.row = row;
    this.col = col;
    this.index = index;
  }

  static pack(index: number) {
    return new DraftLocation('pack', -1, -1, index);
  }

  static picks(row: number, col: number, index: number) {
    return new DraftLocation('picks', row, col, index);
  }

  static deck(row: number, col: number, index: number) {
    return new DraftLocation('deck', row, col, index);
  }

  static sideboard(row: number, col: number, index: number) {
    return new DraftLocation('sideboard', row, col, index);
  }

  equals(other: DraftLocation) {
    if (this.type !== other.type) {
      return false;
    }

    if (this.type === 'pack') {
      return this.index === other.index;
    }

    return arraysEqual([this.row, this.col, this.index], [other.row, other.col, other.index]);
  }

  toString() {
    if (this.type === 'pack') {
      return `DraftLocation.${this.type}(${this.index})`;
    }

    return `DraftLocation.${this.type}(${this.row}, ${this.col}, ${this.index})`;
  }
}

export const addCard = (cards: number[][][], target: DraftLocation, card: number): number[][][] => {
  const newCards = [...cards];

  if (newCards[target.row].length < 1 + target.col) {
    newCards[target.row] = newCards[target.row].concat(
      new Array(1 + target.col - newCards[target.row].length).fill([]),
    );
  }

  newCards[target.row] = [...newCards[target.row]];
  newCards[target.row][target.col] = [...newCards[target.row][target.col]];
  newCards[target.row][target.col].splice(target.index, 0, card);
  return newCards;
};

export const removeCard = (cards: number[][][], source: DraftLocation): [number, number[][][]] => {
  const newCards = [...cards];
  newCards[source.row] = [...newCards[source.row]];
  newCards[source.row][source.col] = [...newCards[source.row][source.col]];
  const [card] = newCards[source.row][source.col].splice(source.index, 1);
  return [card, newCards];
};

export const moveCard = (cards: number[][][], source: DraftLocation, target: DraftLocation): number[][][] => {
  let newCards = [...cards];

  if (source.type !== target.type) {
    throw new Error('Cannot move card between different locations');
  }

  if (source.row === target.row && source.col === target.col) {
    // moving within the same stack
    if (source.index === target.index) {
      return newCards;
    }

    if (source.index > target.index) {
      // moving up, so we need to remove the card first, then adjust it for the new index
      const [card, newSource] = removeCard(newCards, source);

      const newTarget = new DraftLocation(target.type, target.row, target.col, target.index - 1);

      return addCard(newSource, newTarget, card);
    }
  }

  // moving between stacks
  const [card, newSource] = removeCard(newCards, source);
  return addCard(newSource, target, card);
};

export default DraftLocation;
