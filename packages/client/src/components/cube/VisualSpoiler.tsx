import React, { useContext, useMemo } from 'react';

import { cardIndex, cardName } from '@utils/cardutil';
import { BoardType, default as CardType } from '@utils/datatypes/Card';
import { sortDeep } from '@utils/sorting/Sort';

import { NumCols } from 'components/base/Layout';
import CardGrid from 'components/card/CardGrid';
import CubeContext from 'contexts/CubeContext';
import DisplayContext from 'contexts/DisplayContext';

interface VisualSpoilerProps {
  cards: CardType[];
  cardsPerRow?: NumCols;
}

const VisualSpoiler: React.FC<VisualSpoilerProps> = ({ cards }) => {
  const { sortPrimary, sortSecondary, sortTertiary, sortQuaternary, cube, canEdit, setModalSelection, setModalOpen } =
    useContext(CubeContext);
  const {
    cardsPerRow,
    displayOptions: { showUnsorted, collapseDuplicateCards: collapseDuplicates },
  } = useContext(DisplayContext);

  const sections = useMemo(() => {
    const deep = sortDeep(
      cards,
      showUnsorted,
      sortQuaternary || 'Alphabetical',
      [sortPrimary || 'Color Category', sortSecondary || 'Types-Multicolor', sortTertiary || 'CMC'],
      cube,
    );
    const leaves: CardType[][] = [];
    const walk = (node: typeof deep) => {
      if (node.length > 0 && Array.isArray(node[0])) {
        for (const [, child] of node as [string, typeof deep][]) walk(child);
      } else {
        leaves.push(node as CardType[]);
      }
    };
    walk(deep);
    return leaves;
  }, [cards, sortPrimary, sortSecondary, sortTertiary, sortQuaternary, showUnsorted, cube]);

  // Each entry is every copy shown under one image; the first copy is the one displayed.
  // Copies only collapse within a sort section, matching Table View.
  const groups = useMemo(() => {
    if (!collapseDuplicates) return sections.flat().map((card) => [card]);

    return sections.flatMap((section) => {
      const byKey = new Map<string, CardType[]>();
      for (const card of section) {
        const key = `${card.board}|${cardName(card)}`;
        const group = byKey.get(key);
        if (group) {
          group.push(card);
        } else {
          byKey.set(key, [card]);
        }
      }
      return Array.from(byKey.values());
    });
  }, [sections, collapseDuplicates]);

  return (
    <div className="my-2">
      <CardGrid
        cards={groups.map((group) => group[0]!)}
        quantities={collapseDuplicates ? groups.map((group) => group.length) : undefined}
        onClick={(card, index) => {
          const group = groups[index]!;
          if (canEdit && group.length > 1) {
            setModalSelection(group.map((c) => ({ board: c.board as BoardType, index: cardIndex(c) })));
          } else {
            setModalSelection({ board: card.board as BoardType, index: cardIndex(card) });
          }
          setModalOpen(true);
        }}
        xs={cardsPerRow}
        cubeTrayDraggable
      />
    </div>
  );
};

export default VisualSpoiler;
