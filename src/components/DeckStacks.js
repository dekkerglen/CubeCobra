import React from 'react';
import PropTypes from 'prop-types';
import { CardBody, CardHeader, CardTitle, Row } from 'reactstrap';

import CardStack from 'components/CardStack';
import DraggableCard from 'components/DraggableCard';
import CardPropType from 'proptypes/CardPropType';
import Location from 'drafting/DraftLocation';

const DeckStacks = ({ cards, title, subtitle, locationType, canDrop, onMoveCard, onClickCard, ...props }) => (
  <>
    <CardHeader {...props}>
      <CardTitle className="mb-0 d-flex flex-row align-items-end">
        <h4 className="mb-0 mr-auto">{title}</h4>
        <h6 className="mb-0 font-weight-normal d-sm-block">{subtitle}</h6>
      </CardTitle>
    </CardHeader>
    <CardBody className="pt-0">
      {cards.map((row, index) => (
        <Row key={/* eslint-disable-line react/no-array-index-key */ index} className="row-low-padding">
          {row.map((column, index2) => (
            <CardStack
              key={/* eslint-disable-line react/no-array-index-key */ index2}
              location={new Location(locationType, [index, index2, 0])}
            >
              {column.map((card, index3) => (
                <div className="stacked" key={/* eslint-disable-line react/no-array-index-key */ index3}>
                  <DraggableCard
                    location={new Location(locationType, [index, index2, index3 + 1])}
                    card={card}
                    canDrop={canDrop}
                    onMoveCard={onMoveCard}
                    onClick={onClickCard}
                  />
                </div>
              ))}
            </CardStack>
          ))}
        </Row>
      ))}
    </CardBody>
  </>
);

DeckStacks.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(CardPropType.isRequired).isRequired).isRequired)
    .isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.node,
  locationType: PropTypes.string.isRequired,
  onMoveCard: PropTypes.func,
  onClickCard: PropTypes.func,
  canDrop: PropTypes.func,
};

DeckStacks.defaultProps = {
  subtitle: false,
  onMoveCard: () => {},
  onClickCard: () => {},
  canDrop: () => true,
};

export default DeckStacks;
