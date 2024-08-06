import React, { useContext } from 'react';
import { Pagination, PaginationItem, PaginationLink } from 'reactstrap';

import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';

import CardGrid from 'components/CardGrid';
import SpoilerImage from 'components/SpoilerImage';
import withCardModal from 'components/WithCardModal';
import CubeContext from 'contexts/CubeContext';
import useQueryParam from 'hooks/useQueryParam';
import { sortDeep } from 'utils/Sort';

const CardModalLink = withCardModal(SpoilerImage);

const VisualSpoiler = ({ cards }) => {
  const { sortPrimary, sortSecondary, sortTertiary, sortQuaternary, cube } = useContext(CubeContext);

  const sorted = sortDeep(cards, cube.showUnsorted, sortQuaternary, sortPrimary, sortSecondary, sortTertiary);
  const cardList = sorted
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
      <Pagination>
        <PaginationItem active={scale === 'small'}>
          <PaginationLink onClick={() => setScale('small')}>Small</PaginationLink>
        </PaginationItem>
        <PaginationItem active={scale === 'medium'}>
          <PaginationLink onClick={() => setScale('medium')}>Medium</PaginationLink>
        </PaginationItem>
        <PaginationItem active={scale === 'large'}>
          <PaginationLink onClick={() => setScale('large')}>Large</PaginationLink>
        </PaginationItem>
      </Pagination>
      <CardGrid cardList={cardList} Tag={CardModalLink} colProps={{ className: sizes }} />
    </>
  );
};

VisualSpoiler.propTypes = {
  cards: PropTypes.arrayOf(CardPropType).isRequired,
};
export default VisualSpoiler;
