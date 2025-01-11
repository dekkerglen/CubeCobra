import { NumCols } from '../base/Layout';
import CardGrid from '../card/CardGrid';
import CubeContext from '../../contexts/CubeContext';
import DisplayContext from '../../contexts/DisplayContext';
import { BoardType, default as CardType } from '../../../datatypes/Card';
import React, { useContext, useMemo } from 'react';
import { cardIndex } from 'utils/cardutil';
import { sortForDownload } from 'utils/Sort';

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
      sortForDownload(
        cards,
        sortPrimary || 'Color Category',
        sortSecondary || 'Types-Multicolor',
        sortTertiary || 'CMC',
        sortQuaternary || 'Alphabetical',
        cube.showUnsorted || false,
      ),
    [cards, cube.showUnsorted, sortQuaternary, sortPrimary, sortSecondary],
  );

  return (
    <div className="my-2">
      <CardGrid
        cards={sorted}
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
