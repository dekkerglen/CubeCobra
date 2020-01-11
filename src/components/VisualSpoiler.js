import React, { useContext } from 'react';

import { Row, Col } from 'reactstrap';

import { sortDeep } from '../util/Sort';

import SortContext from './SortContext';
import SpoilerImage from './SpoilerImage';

const VisualSpoiler = ({ cards, ...props }) => {
  const { primary, secondary, tertiary } = useContext(SortContext);
  const sorted = sortDeep(cards, primary, secondary, tertiary);
  return (
    <Row noGutters className="justify-content-center" {...props}>
      {sorted.map(([label1, group1]) =>
        group1.map(([label2, group2]) =>
          group2.map(([label3, group3]) =>
            group3.map((card) => (
              <Col key={card.index} xs={6} sm={4} className="col-md-1-5">
                <SpoilerImage card={card} />
              </Col>
            )),
          ),
        ),
      )}
    </Row>
  );
};

export default VisualSpoiler;
