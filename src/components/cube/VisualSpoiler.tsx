import { NumCols } from 'components/base/Layout';
import CardGrid from 'components/card/CardGrid';
import CubeContext from 'contexts/CubeContext';
import DisplayContext from 'contexts/DisplayContext';
import { BoardType, default as Card, default as CardType } from 'datatypes/Card';
import React, { useContext, useMemo } from 'react';
import { cardIndex } from 'utils/Card';
import { sortDeep } from 'utils/Sort';

interface VisualSpoilerProps {
  cards: CardType[];
  cardsPerRow?: NumCols;
}

const VisualSpoiler: React.FC<VisualSpoilerProps> = ({ cards }) => {
  const { sortPrimary, sortSecondary, sortTertiary, sortQuaternary, cube, setModalSelection, setModalOpen } =
    useContext(CubeContext);
  const { cardsPerRow } = useContext(DisplayContext);

  const sorted = useMemo(
    () =>
      sortDeep(
        cards,
        cube.showUnsorted || false,
        sortQuaternary || 'Alphabetical',
        sortPrimary || 'Color Category',
        sortSecondary || 'Types-Multicolor',
        sortTertiary || 'CMC',
      ) as unknown as [string, [string, [string, Card[]][]][]][],
    [cards, cube.showUnsorted, sortQuaternary, sortPrimary, sortSecondary],
  );
  const cardList: Card[] = sorted
    .map((tuple1) => tuple1[1].map((tuple2) => tuple2[1].map((tuple3) => tuple3[1].map((card) => card))))
    .flat(4);

  return (
    <div className="my-2">
      <CardGrid
        cards={cardList}
        onClick={(card) => {
          setModalSelection({ board: card.board as BoardType, index: cardIndex(card) });
          setModalOpen(true);
        }}
        xs={cardsPerRow}
      />
    </div>
  );
};

export default VisualSpoiler;
