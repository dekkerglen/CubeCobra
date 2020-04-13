import React, { useContext } from 'react';

import { Row, Col } from 'reactstrap';

import { sortDeep } from '../utils/Sort';

import SortContext from './SortContext';
import SpoilerImage from './SpoilerImage';
import CardGrid from './CardGrid';

const VisualSpoiler = ({ cards, ...props }) => {
  const { primary, secondary, tertiary } = useContext(SortContext);
  const sorted = sortDeep(cards, primary, secondary, tertiary);
  const cardList = sorted.map(([label1, group1]) => 
                    group1.map(([label2, group2]) =>
                      group2.map(([label3, group3]) =>
                        group3.map((card) => card )))).flat(4);
  return (
    <CardGrid
      cardList={cardList}
      Tag={SpoilerImage}
      colProps={{ xs: 6, sm: 4, className: 'col-md-1-5' }}
    />
  );
};

export default VisualSpoiler;
