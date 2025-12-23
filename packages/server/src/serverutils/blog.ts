import { BoardChanges, BoardType, Changes } from '@utils/datatypes/Card';

import { cardFromId } from './carddb';

/**
 * Converts a changelog object to human-readable text format.
 * Used for RSS feeds and other text-based changelog displays.
 */
export const changelogToText = (changelog: Changes): string => {
  let result = '';

  for (const [board, name] of [
    ['mainboard', 'Mainboard'],
    ['sideboard', 'Sideboard'],
  ]) {
    if (!changelog[board as BoardType]) {
      continue;
    }

    const boardChanges = changelog[board as BoardType] as BoardChanges;

    result += `${name}:\n`;

    if (boardChanges.adds) {
      result += `Added:\n${boardChanges.adds.map((add) => cardFromId(add.cardID).name).join('\n')}\n`;
    }

    if (boardChanges.removes) {
      result += `Removed:\n${boardChanges.removes
        .map((remove) => cardFromId(remove.oldCard.cardID).name)
        .join('\n')}\n`;
    }

    if (boardChanges.swaps) {
      result += `Swapped:\n${boardChanges.swaps
        .map((swap) => `${cardFromId(swap.oldCard.cardID).name} -> ${cardFromId(swap.card.cardID).name}`)
        .join('\n')}\n`;
    }

    if (boardChanges.edits) {
      result += `Edited:\n${boardChanges.edits.map((edit) => `${cardFromId(edit.oldCard.cardID).name}`).join('\n')}\n`;
    }
  }

  return result;
};
