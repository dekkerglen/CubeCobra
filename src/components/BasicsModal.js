import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';

import { Button, Row, Col, Modal, ModalBody, ModalFooter, ModalHeader, Input, Card } from 'reactstrap';

import { buildDeck } from 'utils/Draft';

const MAX_BASICS = 21;

const BasicsModal = ({ isOpen, toggle, addBasics, deck, basics }) => {
  const [counts, setCounts] = useState(basics.map(() => 0));

  const handleAddBasics = useCallback(() => {
    addBasics(counts);
    setCounts(basics.map(() => 0));
    toggle();
  }, [addBasics, toggle, basics, counts]);

  const calculateBasics = useCallback(async () => {
    const { deck: newDeck } = await buildDeck(deck.flat(2), basics);

    console.log(newDeck);

    const newCounts = basics.map(() => 0);

    for (const col of newDeck) {
      for (const card of col) {
        if (card.isUnlimited) {
          newCounts[card.basicId] += 1;
        }
      }
    }

    setCounts(newCounts);
  }, [deck, basics]);

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="xl">
      <ModalHeader toggle={toggle}>Add Basic Lands</ModalHeader>
      <ModalBody>
        <Row>
          {basics.map((card, index) => (
            <Col className="col-6 col-md-2-4 col-lg-2-4 col-xl-2-4" key={`basics-${card.details._id}`}>
              <Card className="mb-3">
                <img className="w-100" src={card.details.image_normal} alt={card.details.name} />
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
  draft: PropTypes.shape({
    initial_state: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.shape({})))).isRequired,
    synergies: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
  }).isRequired,
  deck: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.shape({}))).isRequired,
  basics: PropTypes.arrayOf(CardPropType).isRequired,
};

export default BasicsModal;
