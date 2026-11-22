import Card, { CardDetails, Changes, isBoardChanges } from '@utils/datatypes/Card';

import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';

export type ChangeKind = 'add' | 'remove' | 'swap' | 'edit';

export interface ChangelogCardEntry {
  card: Card;
  kind: ChangeKind;
  swapId?: string;
}

export interface ChangelogBoardRows {
  board: string;
  added: ChangelogCardEntry[];
  removed: ChangelogCardEntry[];
  edited: ChangelogCardEntry[];
  addCount: number;
  removeCount: number;
  editCount: number;
}

export function changelogToBoardRows(changelog: Changes): ChangelogBoardRows[] {
  const rows: ChangelogBoardRows[] = [];
  for (const [board, value] of Object.entries(changelog)) {
    if (board === 'version' || !isBoardChanges(value)) continue;
    const adds = value.adds || [];
    const removes = value.removes || [];
    const swaps = value.swaps || [];
    const edits = value.edits || [];
    if (adds.length + removes.length + swaps.length + edits.length === 0) continue;

    const swapId = (swapIndex: number) => `${board}:${swapIndex}`;
    rows.push({
      board,
      added: [
        ...adds.map((card): ChangelogCardEntry => ({ card, kind: 'add' })),
        ...swaps.map((swap, i): ChangelogCardEntry => ({ card: swap.card, kind: 'swap', swapId: swapId(i) })),
      ],
      removed: [
        ...removes.map((remove): ChangelogCardEntry => ({ card: remove.oldCard, kind: 'remove' })),
        ...swaps.map((swap, i): ChangelogCardEntry => ({ card: swap.oldCard, kind: 'swap', swapId: swapId(i) })),
      ],
      edited: edits.map((edit): ChangelogCardEntry => ({ card: edit.newCard, kind: 'edit' })),
      addCount: adds.length + swaps.length,
      removeCount: removes.length + swaps.length,
      editCount: edits.length,
    });
  }
  return rows;
}

// Server sends changelogs without card.details to keep response sizes down
// (see ChangelogDynamoDao.sanitizeChangelog). Resolve every cardID once
// through the IndexedDB cache, then hydrate cards with withDetails.
export function collectChangelogCardIDs(changelog: Changes): string[] {
  const set = new Set<string>();
  for (const [key, value] of Object.entries(changelog)) {
    if (key === 'version' || !isBoardChanges(value)) continue;
    for (const c of value.adds || []) if (c?.cardID) set.add(c.cardID);
    for (const r of value.removes || []) if (r?.oldCard?.cardID) set.add(r.oldCard.cardID);
    for (const s of value.swaps || []) {
      if (s?.oldCard?.cardID) set.add(s.oldCard.cardID);
      if (s?.card?.cardID) set.add(s.card.cardID);
    }
    for (const e of value.edits || []) {
      if (e?.oldCard?.cardID) set.add(e.oldCard.cardID);
      if (e?.newCard?.cardID) set.add(e.newCard.cardID);
    }
  }
  return [...set];
}

export function withDetails(card: Card | undefined, detailsById: Record<string, CardDetails | null>): Card {
  if (!card) return card as any;
  if (card.details) return card;
  const details = (card.cardID && detailsById[card.cardID]) || getPlaceholderCardDetails(card?.cardID || '');
  return { ...card, details };
}
