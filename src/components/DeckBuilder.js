import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';

import CardStack from 'components/CardStack';
import { CardBody, Row, Col, Card } from 'reactstrap';

import useEventListener from 'hooks/useEventListener';

const DeckBuilder = ({ cube, cubeID, initialDeck, basics }) => {
  const [deck, setDeck] = useState(initialDeck.seats[0].deck);
  // this is the location of the card we are holding
  const [hold, setHold] = useState([-1, -1]);
  // this is the location of the placeholder card
  const [card, setCard] = useState(null);

  const onMouseUp = (event) => {
    if (event.which === 1) {
      if (hold[0] !== -1 && hold[1] !== -1) {
        deck[hold[0]][hold[1]].hold = false;
        setHold([-1, -1]);
        setDeck([...deck]);
      }
    }
  };

  const pickupStack = (stack, index) => {
    deck[stack][index].hold = true;
    setHold([stack, index]);
    setDeck([...deck]);
  };

  const handleHover = (stack, index) => {
    console.log(`Hovering ${stack}, ${index}`);
    if (hold[0] !== -1 && hold[1] !== -1 && stack !== -1 && index !== -1) {
      if (hold[0] !== stack || hold[1] !== index) {
        const item = deck[hold[0]].splice(hold[1], 1)[0];
        deck[stack].splice(index, 0, item);
        setHold([stack, index]);
      }
    }
  };

  // Add event listener using our hook
  useEventListener('mouseup', onMouseUp);

  return (
    <div>
      <Row className="mt-3">
        <Col lg={3} xs={3}>
          <Card>
            <CardStack
              cards={deck[6]}
              pickup={(index) => pickupStack(6, index)}
              onHover={(index) => handleHover(6, index)}
            />
          </Card>
        </Col>
        <Col lg={3} xs={3}>
          <Card>
            <CardStack
              cards={deck[14]}
              pickup={(index) => pickupStack(14, index)}
              onHover={(index) => handleHover(14, index)}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

DeckBuilder.propTypes = {
  basics: PropTypes.objectOf(PropTypes.object).isRequired,
  cube: PropTypes.shape({}).isRequired,
  cubeID: PropTypes.string.isRequired,
  initialDeck: PropTypes.shape({
    seats: PropTypes.arrayOf(
      PropTypes.shape({
        description: PropTypes.string.isRequired,
        deck: PropTypes.array.isRequired,
        sideboard: PropTypes.array.isRequired,
        username: PropTypes.string.isRequired,
        userid: PropTypes.string,
        bot: PropTypes.array,
        name: PropTypes.string.isRequired,
      }),
    ).isRequired,
  }).isRequired,
};

export default DeckBuilder;
