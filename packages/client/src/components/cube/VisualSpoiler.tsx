import React, { useContext, useMemo } from 'react';

import { cardIndex, cardName } from '@utils/cardutil';
import { BoardType, default as CardType } from '@utils/datatypes/Card';
import { sortForDownload } from '@utils/sorting/Sort';

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

  const sorted = useMemo(
    () =>
      sortForDownload(
        cards,
        sortPrimary || 'Color Category',
        sortSecondary || 'Types-Multicolor',
        sortTertiary || 'CMC',
        sortQuaternary || 'Alphabetical',
        showUnsorted,
        cube,
      ),
    [cards, sortPrimary, sortSecondary, sortTertiary, sortQuaternary, showUnsorted, cube],
  );

  // Each entry is every copy shown under one image; the first copy is the one displayed.
  const groups = useMemo(() => {
    if (!collapseDuplicates) return sorted.map((card) => [card]);

    const byKey = new Map<string, CardType[]>();
    for (const card of sorted) {
      const key = `${card.board}|${cardName(card)}`;
      const group = byKey.get(key);
      if (group) {
        group.push(card);
      } else {
        byKey.set(key, [card]);
      }
    }
    return Array.from(byKey.values());
  }, [sorted, collapseDuplicates]);

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
