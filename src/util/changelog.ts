import Card, { BoardChanges, Changes, CubeCardChange, CubeCardEdit, CubeCardSwap } from './../datatypes/Card';

interface NonAddOp {
  op: 'remove' | 'swap' | 'edit';
  version: number;
  data: any;
}

const boards: (keyof Pick<Changes, 'mainboard' | 'maybeboard'>)[] = ['mainboard', 'maybeboard'];

export function mergeChanges(changes: Changes[]): Changes {
  const mergedVersion = changes.reduce(
    (max, change) => (change.version && change.version > max ? change.version : max),
    0,
  );

  const merged: Changes = { version: mergedVersion };

  boards.forEach((board) => {
    const addOps: { version: number; card: Card }[] = [];
    const nonAddOps = new Map<number, NonAddOp>();

    for (const change of changes) {
      const boardChange = change[board];
      if (!boardChange) continue;
      const currentVersion = change.version || 0;

      boardChange.adds?.forEach((card: Card) => {
        if (card.index !== undefined) {
          const removal = nonAddOps.get(card.index);
          if (removal?.op === 'remove') {
            nonAddOps.delete(card.index);
            return;
          }
        }
        addOps.push({ version: currentVersion, card });
      });

      boardChange.removes?.forEach((rem: CubeCardChange) => {
        const idx = rem.index;
        let foundAdd = false;
        for (let i = addOps.length - 1; i >= 0; i--) {
          if (addOps[i].card.index === idx) {
            addOps.splice(i, 1);
            foundAdd = true;
          }
        }

        if (foundAdd) {
          return;
        }

        const existing = nonAddOps.get(idx);
        if (!existing || currentVersion > existing.version) {
          nonAddOps.set(idx, { op: 'remove', version: currentVersion, data: rem });
        }
      });

      boardChange.swaps?.forEach((swap: CubeCardSwap) => {
        const idx = swap.index;
        for (let i = addOps.length - 1; i >= 0; i--) {
          if (addOps[i].card.index === idx) {
            addOps.splice(i, 1);
          }
        }

        const existing = nonAddOps.get(idx);
        if (!existing || currentVersion > existing.version) {
          nonAddOps.set(idx, { op: 'swap', version: currentVersion, data: swap });
        }
      });

      boardChange.edits?.forEach((edit: CubeCardEdit) => {
        const idx = edit.index;
        let updatedInAdd = false;

        for (let i = 0; i < addOps.length; i++) {
          if (addOps[i].card.index === idx) {
            if (currentVersion >= addOps[i].version) {
              addOps[i] = { version: currentVersion, card: edit.newCard };
            }
            updatedInAdd = true;
          }
        }

        if (updatedInAdd) {
          return;
        }

        const existing = nonAddOps.get(idx);
        if (!existing || currentVersion > existing.version) {
          nonAddOps.set(idx, { op: 'edit', version: currentVersion, data: edit });
        }
      });
    }

    const mergedBoard: BoardChanges = {};

    if (addOps.length > 0) {
      mergedBoard.adds = addOps.map((x) => x.card);
    }

    nonAddOps.forEach(({ op, data }) => {
      switch (op) {
        case 'remove':
          mergedBoard.removes = mergedBoard.removes || [];
          mergedBoard.removes.push(data);
          break;
        case 'swap':
          mergedBoard.swaps = mergedBoard.swaps || [];
          mergedBoard.swaps.push(data);
          break;
        case 'edit':
          mergedBoard.edits = mergedBoard.edits || [];
          mergedBoard.edits.push(data);
      }
    });

    merged[board] = mergedBoard;
  });

  return merged;
}

export function revertChanges(changes: Changes[]): Changes {
  const merged = mergeChanges(changes);
  const reverted: Changes = { version: merged.version };

  boards.forEach((board) => {
    const mergedBoard: BoardChanges = merged[board] || {};
    const revertBoard: BoardChanges = {};

    if (mergedBoard.adds) {
      mergedBoard.adds.forEach((card) => {
        revertBoard.removes = revertBoard.removes || [];
        revertBoard.removes.push({ index: card.index || -1, oldCard: card });
      });
    }

    if (mergedBoard.removes) {
      mergedBoard.removes.forEach((rem) => {
        revertBoard.adds = revertBoard.adds || [];
        revertBoard.adds.push(rem.oldCard);
      });
    }

    if (mergedBoard.swaps) {
      mergedBoard.swaps.forEach((swap) => {
        revertBoard.adds = revertBoard.adds || [];
        revertBoard.removes = revertBoard.removes || [];
        revertBoard.adds.push(swap.oldCard);
        revertBoard.removes.push({ index: swap.index, oldCard: swap.card });
      });
    }

    if (mergedBoard.edits) {
      mergedBoard.edits.forEach((edit) => {
        revertBoard.edits = revertBoard.edits || [];
        revertBoard.edits.push({
          index: edit.index,
          oldCard: edit.newCard,
          newCard: edit.oldCard,
        });
      });
    }

    reverted[board] = revertBoard;
  });

  return reverted;
}

const matchCard = (cardA: Card, cardB: Card): boolean => {
  if (cardA.details?.oracle_id && cardB.details?.oracle_id) {
    return cardA.details.oracle_id === cardB.details.oracle_id;
  }

  return cardA.index === cardB.index;
};

const applyBoardReversedChanges = (cards: Card[], boardOps?: BoardChanges): Card[] => {
  let board: Card[] = [...cards].sort((a, b) => (a.index || 0) - (b.index || 0));

  if (boardOps?.removes) {
    board = board.filter((card) => !boardOps.removes?.some((removal) => matchCard(card, removal.oldCard)));
  }

  if (boardOps?.edits) {
    board = board.map((card) => {
      const editOp = boardOps.edits?.find((e) => matchCard(card, e.oldCard));
      return editOp ? editOp.newCard : card;
    });
  }

  if (boardOps?.adds) {
    board = board.concat(boardOps.adds);
  }

  board.sort((a, b) => (a.index || 0) - (b.index || 0));
  board = board.map((card, i) => ({ ...card, index: i }));

  return board;
};

export const applyReversedChanges = (
  cube: { mainboard: Card[]; maybeboard: Card[] },
  changes: Changes[],
): {
  mainboard: Card[];
  maybeboard: Card[];
} => {
  const reversed = revertChanges(changes);

  return {
    mainboard: applyBoardReversedChanges(cube.mainboard, reversed.mainboard),
    maybeboard: applyBoardReversedChanges(cube.maybeboard, reversed.maybeboard),
  };
};
