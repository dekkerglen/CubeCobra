import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';
import { csrfFetch } from 'utils/CSRF';
import withAutocard from 'components/WithAutocard';
import { getCardColorClass } from 'contexts/TagContext';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  CustomInput,
  UncontrolledAlert,
  Spinner,
  ListGroup,
  ListGroupItem,
} from 'reactstrap';

const AutocardItem = withAutocard(ListGroupItem);

const AddGroupToCubeModal = ({ cards, isOpen, toggle, cubes }) => {
  const [selectedCube, setSelectedCube] = useState(cubes && cubes.length > 0 ? cubes[0]._id : null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const response = await csrfFetch(`/cube/api/getdetailsforcards`, {
        method: 'POST',
        body: JSON.stringify({
          cards,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success === 'true') {
          setDetails(json.details);
          setLoading(false);
        }
      }
      return [];
    };
    fetchData();
  }, [cards, setDetails, setLoading]);

  const add = async () => {
    try {
      const response = await csrfFetch(`/cube/api/addtocube/${selectedCube}`, {
        method: 'POST',
        body: JSON.stringify({
          cards,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const json = await response.json();
        if (json.success === 'true') {
          toggle();
        }
      } else {
        setAlerts([...alerts, { color: 'danger', message: 'Error, could not add card' }]);
      }
    } catch (err) {
      setAlerts([...alerts, { color: 'danger', message: 'Error, could not add card' }]);
    }
  };

  const maybe = async () => {
    try {
      const response = await csrfFetch(`/cube/api/maybe/${selectedCube}`, {
        method: 'POST',
        body: JSON.stringify({
          add: details.map((detail) => ({ details: detail })),
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const json = await response.json();
        if (json.success === 'true') {
          toggle();
        }
      } else {
        setAlerts([...alerts, { color: 'danger', message: 'Error, could not maybeboard card' }]);
      }
    } catch (err) {
      setAlerts([...alerts, { color: 'danger', message: 'Error, could not maybeboard card' }]);
    }
  };

  if (loading) {
    return (
      <Modal isOpen={isOpen} toggle={toggle} size="xs">
        <ModalHeader toggle={toggle}>Add Package to Cube</ModalHeader>
        <div className="centered py-3 my-4">
          <Spinner className="position-absolute" />
        </div>
        <ModalFooter>
          <Button color="danger" onClick={toggle}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    );
  }

  if (!cubes || cubes.length === 0) {
    return (
      <Modal isOpen={isOpen} toggle={toggle} size="xs">
        <ModalHeader toggle={toggle}>Add Package to Cube</ModalHeader>
        <ModalBody>
          {cards.map((c) => (
            <p>{c}</p>
          ))}
          <p>You don't appear to have any cubes to add this card to. Are you logged in?</p>
        </ModalBody>
        <ModalFooter>
          <Button color="danger" onClick={toggle}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="xs">
      <ModalHeader toggle={toggle}>Add Package to Cube</ModalHeader>
      <ModalBody>
        {' '}
        {alerts.map(({ color, message }) => (
          <UncontrolledAlert key={message} color={color} className="mt-2">
            {message}
          </UncontrolledAlert>
        ))}
        <ListGroup className="list-outline">
          {details.map((card) => (
            <AutocardItem
              key={card.index}
              card={{ details: card }}
              className={`card-list-item d-flex flex-row ${getCardColorClass({ details: card })}`}
              data-in-modal
              index={card.index}
            >
              <>{card.name}</>
            </AutocardItem>
          ))}
        </ListGroup>
        <InputGroup className="my-3">
          <InputGroupAddon addonType="prepend">
            <InputGroupText>Cube: </InputGroupText>
          </InputGroupAddon>
          <CustomInput type="select" value={selectedCube} onChange={(event) => setSelectedCube(event.target.value)}>
            {cubes.map((cube) => (
              <option value={cube._id}>{cube.name}</option>
            ))}
          </CustomInput>
        </InputGroup>
      </ModalBody>
      <ModalFooter>
        <Button color="success" onClick={add}>
          Add
        </Button>
        <Button color="secondary" onClick={maybe}>
          Maybeboard
        </Button>
        <Button color="danger" onClick={toggle}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

AddGroupToCubeModal.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.string).isRequired,
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  cubes: PropTypes.arrayOf(CubePropType).isRequired,
};

export default AddGroupToCubeModal;
