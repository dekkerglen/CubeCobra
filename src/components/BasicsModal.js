import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';

import { csrfFetch } from 'utils/CSRF';
import { Button, Row, Col, Modal, ModalBody, ModalFooter, ModalHeader, Input, Card } from 'reactstrap';

const MAX_BASICS = 21;

function BasicsModal({ isOpen, toggle, addBasics, deck, basics, cards }) {
  const [counts, setCounts] = useState(basics.map(() => 0));

  const handleAddBasics = useCallback(() => {
    addBasics(counts);
    setCounts(basics.map(() => 0));
    toggle();
  }, [addBasics, toggle, basics, counts]);

  const calculateBasics = useCallback(async () => {
    const response = await csrfFetch('/cube/api/calculatebasics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mainboard: deck.map((index) => cards[index].details),
        basics: basics.map((index) => cards[index].details),
      }),
    });

    const json = await response.json();

    if (json.success === 'true') {
      const newCounts = basics.map(() => 0);

      const toIndex = json.basics.map((card) =>
        basics.findIndex((index) => cards[index].details.oracle_id === card.oracle_id),
      );

      console.log(toIndex);

      for (const index of toIndex) {
        newCounts[index] += 1;
      }

      setCounts(newCounts);
    } else {
      console.error(json);
    }
  }, [deck, basics, cards]);

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="xl">
      <ModalHeader toggle={toggle}>Add Basic Lands</ModalHeader>
      <ModalBody>
        <Row>
          {basics.map((cardIndex, index) => (
            <Col
              className="col-6 col-md-2-4 col-lg-2-4 col-xl-2-4"
              key={`basics-${cards[cardIndex].details.scryfall_id}`}
            >
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
        <Button type="submit" color="accent" onClick={handleAddBasics}>
          Add
        </Button>
        <Button color="accent" onClick={calculateBasics}>
          Calculate
        </Button>
        <Button color="secondary" onClick={toggle}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}

BasicsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  addBasics: PropTypes.func.isRequired,
  deck: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number))).isRequired,
  basics: PropTypes.arrayOf(PropTypes.number).isRequired,
  cards: PropTypes.arrayOf(CardPropType).isRequired,
};

export default BasicsModal;
