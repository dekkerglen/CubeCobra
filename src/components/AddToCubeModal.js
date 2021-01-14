import { useState } from 'react';
import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';
import ImageFallback from 'components/ImageFallback';
import { csrfFetch } from 'utils/CSRF';
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
} from 'reactstrap';

const AddToCubeModal = ({ card, isOpen, toggle, hideAnalytics, cubeContext, cubes }) => {
  let def = cubeContext;
  if (cubes.length > 0) {
    def = cubes.map((cube) => cube._id).includes(cubeContext) ? cubeContext : cubes[0]._id;
  }
  const [selectedCube, setSelectedCube] = useState(cubes && cubes.length > 0 ? def : '');
  const [alerts, setAlerts] = useState([]);

  const add = async () => {
    try {
      const response = await csrfFetch(`/cube/api/addtocube/${selectedCube}`, {
        method: 'POST',
        body: JSON.stringify({
          add: { details: card },
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
          add: [{ details: card }],
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

  if (!cubes || cubes.length === 0) {
    return (
      <Modal isOpen={isOpen} toggle={toggle} size="xs">
        <ModalHeader toggle={toggle}>{card.name}</ModalHeader>
        <ModalBody>
          <ImageFallback
            className="w-100 mb-3"
            src={card.image_normal}
            fallbackSrc="/content/default_card.png"
            alt={card.name}
          />
          <p>You don't appear to have any cubes to add this card to. Are you logged in?</p>
        </ModalBody>
        <ModalFooter>
          {!hideAnalytics && (
            <Button color="primary" href={`/tool/card/${card._id}`} target="_blank">
              Analytics
            </Button>
          )}
          <Button color="danger" onClick={toggle}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="xs">
      <ModalHeader toggle={toggle}>{`Add ${card.name} to Cube`}</ModalHeader>
      <ModalBody>
        {' '}
        {alerts.map(({ color, message }) => (
          <UncontrolledAlert key={message} color={color} className="mt-2">
            {message}
          </UncontrolledAlert>
        ))}
        <ImageFallback
          className="w-100"
          src={card.image_normal}
          fallbackSrc="/content/default_card.png"
          alt={card.name}
        />
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
        {!hideAnalytics && (
          <Button color="primary" href={`/tool/card/${card._id}`} target="_blank">
            Analytics
          </Button>
        )}
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

AddToCubeModal.propTypes = {
  card: PropTypes.shape({
    name: PropTypes.string.isRequired,
    image_normal: PropTypes.string.isRequired,
    _id: PropTypes.string.isRequired,
  }).isRequired,
  isOpen: PropTypes.bool.isRequired,
  hideAnalytics: PropTypes.bool,
  toggle: PropTypes.func.isRequired,
  cubeContext: PropTypes.string,
  cubes: PropTypes.arrayOf(CubePropType).isRequired,
};

AddToCubeModal.defaultProps = {
  hideAnalytics: false,
  cubeContext: null,
};

export default AddToCubeModal;
