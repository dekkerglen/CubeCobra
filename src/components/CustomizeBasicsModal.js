import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';

import { Modal, ModalBody, ModalHeader, Button, ModalFooter, Row, Col, Card } from 'reactstrap';

import { csrfFetch } from 'utils/CSRF';
import LoadingButton from 'components/LoadingButton';
import AutocompleteInput from 'components/AutocompleteInput';

const CustomizeBasicsModal = ({ isOpen, toggle, cube, updateBasics, onError }) => {
  const [basics, setBasics] = useState(cube.basics.slice());
  const [cardName, setCardName] = useState('');
  const [imageDict, setImageDict] = useState({});

  useEffect(() => {
    fetch('/cube/api/imagedict')
      .then((response) => response.json())
      .then((json) => {
        setImageDict(json.dict);
      });
  }, []);

  const submitCard = () => {
    if (imageDict) {
      const result = imageDict[cardName.toLowerCase()];
      if (result) {
        setBasics([...basics, result.id]);
        setCardName('');
      }
    }
  };

  const save = async () => {
    const response = await csrfFetch(`/cube/api/updatebasics/${cube._id}`, {
      method: 'POST',
      body: JSON.stringify(basics),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (response.ok) {
      updateBasics(basics);
      toggle();
    } else {
      onError('Error updating basics');
    }
  };

  return (
    <Modal size="xl" isOpen={isOpen} toggle={toggle}>
      <ModalHeader toggle={toggle}>Customize Basics</ModalHeader>
      <ModalBody>
        <p>
          This set of cards will have an unlimited quantity available when constructing decks. You can use this to
          select which art your cube's basics will use, provide multiple art options for your drafters, and also provide
          snow-covered basics. These don't necessarily have to be basic lands, but using an unconventional setup here
          may result in confusing our draft bots' deckbuilding.
        </p>
        <Row className="pb-3">
          <Col xs="12" md="8">
            <AutocompleteInput
              treeUrl="/cube/api/fullnames"
              treePath="cardnames"
              type="text"
              className="mr-2"
              name="remove"
              value={cardName}
              onChange={(event) => setCardName(event.target.value)}
              onSubmit={(event) => event.preventDefault()}
              placeholder="Card name and version"
              autoComplete="off"
              data-lpignore
            />
          </Col>
          <Col xs="12" md="4">
            <Button
              color="success"
              block
              onClick={submitCard}
              disabled={!(imageDict && imageDict[cardName.toLowerCase()])}
            >
              Add Card
            </Button>
          </Col>
        </Row>
        <Row>
          {basics.map((cardId, index) => (
            <Col key={cardId} className="col-sm-6 col-md-2-4 col-lg-2-4 col-xl-2-4">
              <Card className="mb-3">
                <img className="w-100" src={`/tool/cardimage/${cardId}`} alt={cardId} />
                <Button
                  className="mt-1"
                  color="danger"
                  outline
                  block
                  onClick={() => {
                    const temp = basics.slice();
                    temp.splice(index, 1);
                    setBasics(temp);
                  }}
                >
                  Remove
                </Button>
              </Card>
            </Col>
          ))}
        </Row>
      </ModalBody>
      <ModalFooter>
        <LoadingButton color="success" outline onClick={save}>
          Save Changes
        </LoadingButton>
        <Button onClick={toggle}>Close</Button>
      </ModalFooter>
    </Modal>
  );
};

CustomizeBasicsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  cube: CubePropType.isRequired,
  updateBasics: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
};

export default CustomizeBasicsModal;
