import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, CardHeader, CardTitle, Row } from 'reactstrap';

import Location from 'utils/DraftLocation';

import CardStack from 'components/CardStack';
import DraggableCard from 'components/DraggableCard';

const DeckStacks = ({ cards, title, subtitle, locationType, canDrop, onMoveCard, onClickCard, ...props }) => (
  <Card {...props}>
    <CardHeader>
      <CardTitle className="mb-0 d-flex flex-row align-items-end">
        <h4 className="mb-0 mr-auto">{title}</h4>
        <h6 className="mb-0 font-weight-normal d-none d-sm-block">{subtitle}</h6>
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
  </Card>
);

DeckStacks.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object))).isRequired,
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

DeckStacks.moveOrAddCard = (cards, target, source) => {
  const newCards = [...cards];
  let card;
  if (Array.isArray(source)) {
    // Source is a location.
    const [sourceRow, sourceCol, sourceIndex] = source;
    newCards[sourceRow][sourceCol] = [...newCards[sourceRow][sourceCol]];
    [card] = newCards[sourceRow][sourceCol].splice(sourceIndex - 1, 1);
  } else {
    // Source is a card itself.
    card = source;
  }

  const [targetRow, targetCol, targetIndex] = target;
  if (newCards[targetRow].length < 1 + targetCol) {
    newCards[targetRow] = newCards[targetRow].concat(new Array(1 + targetCol - newCards[targetRow].length).fill([]));
  }
  newCards[targetRow][targetCol] = [...newCards[targetRow][targetCol]];
  newCards[targetRow][targetCol].splice(targetIndex, 0, card);
  return newCards;
};

DeckStacks.removeCard = (cards, source) => {
  const newCards = [...cards];
  const [sourceRow, sourceCol, sourceIndex] = source;
  newCards[sourceRow][sourceCol] = [...newCards[sourceRow][sourceCol]];
  const [card] = newCards[sourceRow][sourceCol].splice(sourceIndex - 1, 1);
  return [card, newCards];
};

export default DeckStacks;
