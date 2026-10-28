import DraftLocation, { addCard, removeCard } from './DraftLocation';

export const discardToPile = (
  board: number[][][],
  source: DraftLocation,
  pile: number[],
): { board: number[][][]; pile: number[] } => {
  const [card, newBoard] = removeCard(board, source);
  return { board: newBoard, pile: [...pile, card] };
};

export const restoreFromPile = (
  pile: number[],
  pileIndex: number,
  board: number[][][],
  target: DraftLocation,
): { board: number[][][]; pile: number[] } => ({
  board: addCard(board, target, pile[pileIndex]),
  pile: pile.filter((_, i) => i !== pileIndex),
});
