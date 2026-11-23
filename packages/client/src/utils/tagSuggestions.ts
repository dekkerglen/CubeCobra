import Card, { BoardChanges, Changes } from '@utils/datatypes/Card';

/** Committed tags plus any tags introduced by cards in the pending (unsaved) changeset. */
export const getTagSuggestions = (committedTags: string[], changes: Changes): string[] => {
  const tags = new Set(committedTags);

  const addTags = (card: Card | undefined) => {
    for (const tag of card?.tags || []) {
      tags.add(tag);
    }
  };

  for (const [board, value] of Object.entries(changes || {})) {
    if (board === 'version' || !value || typeof value !== 'object') {
      continue;
    }
    const boardChanges = value as BoardChanges;
    (boardChanges.adds || []).forEach(addTags);
    (boardChanges.edits || []).forEach((edit) => addTags(edit.newCard));
    (boardChanges.swaps || []).forEach((swap) => addTags(swap.card));
  }

  return [...tags];
};
