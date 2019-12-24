import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, CardHeader, CardTitle, Col, Input, Row } from 'reactstrap';

import Location from '../util/DraftLocation';

import CardStack from './CardStack';
import DraggableCard from './DraggableCard';

const DeckStacks = ({ cards, title, locationType, canDrop, onMoveCard, onClickCard, ...props }) =>
  <Card {...props}>
    <CardHeader>
      <CardTitle className="mb-0">
        <h4 className="mb-0">{title}</h4>
      </CardTitle>
    </CardHeader>
    <CardBody className="pt-0">
      {cards.map((row, index) =>
        <Row key={index} className="row-low-padding">
          {row.map((column, index2) =>
            <CardStack key={index2} location={new Location(locationType, [index, index2, 0])}>
              {column.map((card, index3) =>
                <div className="stacked" key={card.details._id}>
                  <DraggableCard
                    location={new Location(locationType, [index, index2, index3 + 1])}
                    card={card}
                    canDrop={canDrop}
                    onMoveCard={onMoveCard}
                    onClick={onClickCard}
                  />
                </div>
              )}
            </CardStack>
          )}
        </Row>
      )}
    </CardBody>
  </Card>;

DeckStacks.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object))).isRequired,
  title: PropTypes.string.isRequired,
  locationType: PropTypes.string,
  onMoveCard: PropTypes.func,
  onClickCard: PropTypes.func,
};

DeckStacks.moveOrAddCard = (cards, target, source) => {
  const newCards = [...cards];
  let card;
  if (Array.isArray(source)) {
    // Source is a location.
    const [sourceRow, sourceCol, sourceIndex] = source;
    newCards[sourceRow][sourceCol] = [...newCards[sourceRow][sourceCol]];
    card = newCards[sourceRow][sourceCol].splice(sourceIndex - 1, 1)[0];
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

DeckStacks.cmcColumn = (card) => {
  let cmc = card.hasOwnProperty('cmc') ? card.cmc : card.details.cmc;
  if (isNaN(cmc)) {
    cmc = cmc.indexOf('.') > -1 ? parseFloat(cmc) : parseInt(cmc);
  }
  // Round to half-integer then take ceiling to support Little Girl
  let cmcDoubleInt = Math.round(cmc * 2);
  let cmcInt = Math.round((cmcDoubleInt + cmcDoubleInt % 2) / 2);
  if (cmcInt < 0) {
    cmcInt = 0;
  }
  if (cmcInt > 7) {
    cmcInt = 7;
  }
  return cmcInt;
};

export default DeckStacks;
