import Card, { Changes, isBoardChanges } from '@utils/datatypes/Card';

import { cardFromId } from './carddb';

// When each card (by oracle id) was in a cube's mainboard, as [start, end) date
// intervals — end is null for cards still in the cube. Records dated before
// `start` predate the cube's known history, so their mainboard is unknown.
export interface MainboardHistory {
  start: number;
  presence: { [oracle: string]: [number, number | null][] };
}

interface ChangelogSource<T extends { date: number }> {
  queryByCube: (cubeId: string, lastKey?: Record<string, any>, limit?: number) => Promise<{ items: T[]; lastKey?: any }>;
  loadChangelogData: (changelog: T) => Promise<Changes>;
}

const defaultOracleOf = (cardID: string): string => cardFromId(cardID).oracle_id;

/**
 * Rebuilds when every oracle was in the mainboard by walking the changelog once,
 * newest to oldest, undoing each change. Stops once it passes `minDate` — older
 * changes can't affect anything dated at or after it.
 */
export async function buildMainboardHistory<T extends { date: number }>(
  cubeId: string,
  currentMainboard: Card[],
  minDate: number,
  source: ChangelogSource<T>,
  oracleOf: (cardID: string) => string = defaultOracleOf,
): Promise<MainboardHistory> {
  // Copies of each oracle in the mainboard at the point the walk has reached.
  const counts = new Map<string, number>();
  const oracle = (cardID: string | undefined): string => (cardID ? oracleOf(cardID) || '' : '');
  for (const card of currentMainboard) {
    const o = oracle(card.cardID);
    if (o) counts.set(o, (counts.get(o) ?? 0) + 1);
  }

  const presence: MainboardHistory['presence'] = {};
  // End of the interval each in-mainboard oracle is currently in (null = still in the cube).
  const openEnd = new Map<string, number | null>();
  for (const [o, n] of counts) if (n > 0) openEnd.set(o, null);

  let earliest: number | undefined;
  let exhausted = false;
  let lastKey: Record<string, any> | undefined;
  do {
    const page = await source.queryByCube(cubeId, lastKey, 100);
    const needed = page.items.filter((item) => item.date > minDate);
    const changelogs = await Promise.all(needed.map((item) => source.loadChangelogData(item)));

    for (let i = 0; i < needed.length; i++) {
      const date = needed[i]!.date;
      earliest = date;
      const board = changelogs[i]?.mainboard;
      if (!isBoardChanges(board)) continue;

      // Whether each touched oracle was in the mainboard before undoing this change.
      const before = new Map<string, boolean>();
      const undo = (cardID: string | undefined, delta: number) => {
        const o = oracle(cardID);
        if (!o) return;
        if (!before.has(o)) before.set(o, (counts.get(o) ?? 0) > 0);
        counts.set(o, (counts.get(o) ?? 0) + delta);
      };
      for (const card of board.adds ?? []) undo(card.cardID, -1);
      for (const remove of board.removes ?? []) undo(remove.oldCard?.cardID, 1);
      for (const swap of board.swaps ?? []) {
        undo(swap.card?.cardID, -1);
        undo(swap.oldCard?.cardID, 1);
      }
      for (const edit of board.edits ?? []) {
        undo(edit.newCard?.cardID, -1);
        undo(edit.oldCard?.cardID, 1);
      }

      for (const [o, was] of before) {
        const now = (counts.get(o) ?? 0) > 0;
        if (was && !now) {
          // Added by this change: its interval starts here.
          (presence[o] ??= []).push([date, openEnd.get(o) ?? null]);
          openEnd.delete(o);
        } else if (!was && now) {
          // Removed by this change: an earlier interval ends here.
          openEnd.set(o, date);
        }
      }
    }

    if (needed.length < page.items.length) break;
    lastKey = page.lastKey;
    if (!lastKey) exhausted = true;
  } while (lastKey);

  // Whatever is still in the mainboard was there since before the walk stopped.
  for (const [o, end] of openEnd) (presence[o] ??= []).push([0, end]);

  // Walking off the end of the changelog means anything older than the earliest
  // change predates the cube's history.
  return { start: exhausted && earliest !== undefined ? earliest : 0, presence };
}
