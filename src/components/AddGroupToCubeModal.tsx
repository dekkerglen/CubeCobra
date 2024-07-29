import LoadingButton from 'components/LoadingButton';
import withAutocard from 'components/WithAutocard';
import CardDetails from 'datatypes/CardDetails';
import CubePropType from 'datatypes/Cube';
import React, { useState } from 'react';
import {
  AlertProps,
  Button,
  Input,
  InputGroup,
  InputGroupText,
  ListGroup,
  ListGroupItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  UncontrolledAlert,
} from 'reactstrap';
import { csrfFetch } from 'utils/CSRF';
import { getColorClass } from 'utils/Util';

export interface AddGroupToCubeModalProps {
  cards: CardDetails[];
  isOpen: boolean;
  toggle: () => void;
  cubes: CubePropType[];
  packid?: string;
}

const AutocardItem = withAutocard(ListGroupItem);

const AddGroupToCubeModal: React.FC<AddGroupToCubeModalProps> = ({ cards, isOpen, toggle, cubes, packid = null }) => {
  const [selectedCube, setSelectedCube] = useState<string | null>(cubes && cubes.length > 0 ? cubes[0].id : null);
  const [alerts, setAlerts] = useState<AlertProps[]>([]);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  const add = async (board: 'mainboard' | 'maybeboard') => {
    setLoadingSubmit(true);
    try {
      const response = await csrfFetch(`/cube/api/addtocube/${selectedCube}`, {
        method: 'POST',
        body: JSON.stringify({
          cards: cards.map((card) => card.scryfall_id),
          packid,
          board,
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
    setLoadingSubmit(false);
  };

  if (!cubes || cubes.length === 0) {
    return (
      <Modal isOpen={isOpen} toggle={toggle} size="xs">
        <ModalHeader toggle={toggle}>Add Package to Cube</ModalHeader>
        <ModalBody>
          <ListGroup className="list-outline">
            {cards.map((card) => (
              <AutocardItem
                key={card.scryfall_id}
                card={{ details: card }}
                className={`card-list-item d-flex flex-row ${getColorClass(card.type, card.colors)}`}
                data-in-modal
              >
                {card.name}
              </AutocardItem>
            ))}
          </ListGroup>
          <p>You don't appear to have any cubes to add this card to. Are you logged in?</p>
        </ModalBody>
        <ModalFooter>
          <Button color="unsafe" onClick={toggle}>
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
          {cards.map((card) => (
            <AutocardItem
              key={card.scryfall_id}
              card={{ details: card }}
              className={`card-list-item d-flex flex-row ${getColorClass(card.type, card.colors)}`}
              data-in-modal
            >
              {card.name}
            </AutocardItem>
          ))}
        </ListGroup>
        <InputGroup className="my-3">
          <InputGroupText>Cube: </InputGroupText>
          <Input type="select" value={selectedCube ?? ''} onChange={(event) => setSelectedCube(event.target.value)}>
            {cubes.map((cube) => (
              <option key={cube.id} value={cube.id}>
                {cube.name}
              </option>
            ))}
          </Input>
        </InputGroup>
      </ModalBody>
      <ModalFooter>
        <LoadingButton loading={loadingSubmit} color="accent" onClick={() => add('mainboard')}>
          Add
        </LoadingButton>
        <LoadingButton loading={loadingSubmit} color="secondary" onClick={() => add('maybeboard')}>
          Maybeboard
        </LoadingButton>
        <Button color="unsafe" onClick={toggle}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default AddGroupToCubeModal;
