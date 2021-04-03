import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';

import { Button, Row, Col, Modal, ModalBody, ModalFooter, ModalHeader, Input, Card } from 'reactstrap';

import { buildDeck } from 'drafting/deckutil';
import { fromEntries } from 'utils/Util';

const MAX_BASICS = 21;

const BasicsModal = ({ isOpen, toggle, addBasics, deck, basics, cards }) => {
  const [counts, setCounts] = useState(basics.map(() => 0));

  const handleAddBasics = useCallback(() => {
    addBasics(counts);
    setCounts(basics.map(() => 0));
    toggle();
  }, [addBasics, toggle, basics, counts]);

  console.debug(
    'cards[basics]',
    basics.map((ci) => cards[ci]),
    'deck[basics]',
    deck.map((ci) => cards[ci]),
  );
  const calculateBasics = useCallback(async () => {
    const { deck: newDeck } = await buildDeck(cards, deck, basics);
    const basicIds = fromEntries(basics.map((ci, idx) => [ci, idx]));

    const newCounts = basics.map(() => 0);

    for (const col of newDeck) {
      for (const cardIndex of col) {
        if ((basicIds[cardIndex] ?? null) !== null) {
          newCounts[basicIds[cardIndex]] += 1;
        }
      }
    }

    setCounts(newCounts);
  }, [deck, basics, cards]);

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="xl">
      <ModalHeader toggle={toggle}>Add Basic Lands</ModalHeader>
      <ModalBody>
        <Row>
          {basics.map((cardIndex, index) => (
            <Col xs="6" md="3" lg="2" key={`basics-${cards[cardIndex].details._id}`}>
              <Card className="mb-3">
                <img
                  className="w-100"
                  src={cards[cardIndex].details.image_normal}
                  alt={cards[cardIndex].details.name}
                />
                <Input
                  className="mt-1"
                  type="select"
                  value={counts[index]}
                  onChange={(e) => {
                    const newCount = [...counts];
                    newCount[index] = parseInt(e.target.value, 10);
                    setCounts(newCount);
                  }}
                >
                  {Array.from(new Array(MAX_BASICS).keys()).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Input>
              </Card>
            </Col>
          ))}
        </Row>
      </ModalBody>
      <ModalFooter>
        <Button type="submit" color="success" onClick={handleAddBasics}>
          Add
        </Button>
        <Button color="success" onClick={calculateBasics}>
          Calculate
        </Button>
        <Button color="secondary" onClick={toggle}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

BasicsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  addBasics: PropTypes.func.isRequired,
  deck: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number))).isRequired,
  basics: PropTypes.arrayOf(PropTypes.number).isRequired,
  cards: PropTypes.arrayOf(CardPropType).isRequired,
};

export default BasicsModal;
