import React, { useContext, useMemo } from 'react';
import { Flexbox } from 'components/base/Layout';
import CardGrid from 'components/card/CardGrid';
import CubeContext from 'contexts/CubeContext';
import useQueryParam from 'hooks/useQueryParam';
import { sortDeep } from 'utils/Sort';
import CardType, { BoardType } from 'datatypes/Card';
import Button from 'components/base/Button';
import Card from 'datatypes/Card';

interface VisualSpoilerProps {
  cards: CardType[];
}

const VisualSpoiler: React.FC<VisualSpoilerProps> = ({ cards }) => {
  const { sortPrimary, sortSecondary, sortTertiary, sortQuaternary, cube, setModalSelection, setModalOpen } =
    useContext(CubeContext);

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
  const [scale, setScale] = useQueryParam('scale', 'medium');

  let sizes = 'col-4 col-sm-3 col-md-2 col-lg-2 col-xl-1-5';

  if (scale === 'small') {
    sizes = 'col-2 col-sm-2 col-md-1-5 col-lg-1-5 col-xl-1';
  } else if (scale === 'large') {
    sizes = 'col-12 col-sm-6 col-md-4 col-lg-4 col-xl-3';
  }

  return (
    <>
      <Flexbox direction="row" justify="center" gap="2" className="my-2">
        <Button onClick={() => setScale('small')} outline={scale !== 'small'}>
          Small
        </Button>
        <Button onClick={() => setScale('medium')} outline={scale !== 'medium'}>
          Medium
        </Button>
        <Button onClick={() => setScale('large')} outline={scale !== 'large'}>
          Large
        </Button>
      </Flexbox>
      <CardGrid
        cards={cardList}
        onClick={(card) => {
          setModalSelection({ board: card.board as BoardType, index: card.index || -1 });
          setModalOpen(true);
        }}
      />
    </>
  );
};

export default VisualSpoiler;
