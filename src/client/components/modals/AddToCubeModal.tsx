import React, { useContext, useState } from 'react';

import { CardDetails } from '../../../datatypes/Card';
import User from '../../../datatypes/User';
import { CSRFContext } from '../../contexts/CSRFContext';
import UserContext from '../../contexts/UserContext';
import useLocalStorage from '../../hooks/useLocalStorage';
import Alert from '../base/Alert';
import Button from '../base/Button';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Select from '../base/Select';
import ImageFallback from '../ImageFallback';
import LoadingButton from '../LoadingButton';

export interface AddToCubeModalProps {
  card: CardDetails;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  hideAnalytics?: boolean;
  cubeContext?: string;
}

interface Alert {
  color: string;
  message: string;
}

const AddToCubeModal: React.FC<AddToCubeModalProps> = ({
  card,
  isOpen,
  setOpen,
  hideAnalytics = false,
  cubeContext,
}) => {
  const { csrfFetch } = useContext(CSRFContext);
  const user: User | null = useContext(UserContext);
  const cubes: { id: string; name: string }[] = user?.cubes ?? [];

  let def = cubeContext;
  if (cubes.length > 0) {
    def = cubes.map((cube) => cube.id).includes(cubeContext ?? '') ? (cubeContext ?? '') : cubes[0].id;
  }
  const [selectedCube, setSelectedCube] = useState<string>(cubes && cubes.length > 0 ? (def ?? '') : '');
  const [selectedBoard, setSelectedBoard] = useLocalStorage<string>('selectedBoardForATCModal', 'mainboard');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const add = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await csrfFetch(`/cube/api/addtocube/${selectedCube}`, {
        method: 'POST',
        body: JSON.stringify({
          cards: [card.scryfall_id],
          board: selectedBoard,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const json = await response.json();
        if (json.success === 'true') {
          setOpen(false);
        }
      } else {
        setAlerts([...alerts, { color: 'danger', message: 'Error, could not add card' }]);
      }
    } catch {
      setAlerts([...alerts, { color: 'danger', message: 'Error, could not add card' }]);
    }
    setLoading(false);
  };

  if (!cubes || cubes.length === 0) {
    return (
      <Modal isOpen={isOpen} setOpen={setOpen} sm scrollable>
        <ModalHeader setOpen={setOpen}>{card.name}</ModalHeader>
        <ModalBody className="centered" scrollable>
          <Flexbox direction="col" alignItems="center" gap="2">
            <ImageFallback
              className="w-full mb-3"
              src={card.image_normal}
              fallbackSrc="/content/default_card.png"
              alt={card.name}
            />
            <p>You don't appear to have any cubes to add this card to. Are you logged in?</p>
          </Flexbox>
        </ModalBody>
        <ModalFooter>
          <Flexbox direction="row" justify="between" gap="2" className="w-full">
            {!hideAnalytics && (
              <Button block color="accent" href={`/tool/card/${card.scryfall_id}`} target="_blank">
                Analytics
              </Button>
            )}
            <Button block color="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
          </Flexbox>
        </ModalFooter>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm scrollable>
      <ModalHeader setOpen={setOpen}>{`Add ${card.name} to Cube`}</ModalHeader>
      <ModalBody scrollable>
        <Flexbox direction="col" alignItems="center" gap="2">
          {alerts.map(({ color, message }) => (
            <Alert key={message} color={color} className="mt-2">
              {message}
            </Alert>
          ))}
          <ImageFallback
            className="w-full"
            src={card.image_normal}
            fallbackSrc="/content/default_card.png"
            alt={card.name}
          />
          <Select
            label="Cube"
            options={cubes.map((cube) => ({ value: cube.id, label: cube.name }))}
            value={selectedCube}
            setValue={(val) => setSelectedCube(val)}
          />
          <Select
            label="Board"
            options={[
              { value: 'mainboard', label: 'Mainboard' },
              { value: 'maybeboard', label: 'Maybeboard' },
            ]}
            value={selectedBoard}
            setValue={(val) => setSelectedBoard(val)}
          />
          <LoadingButton block loading={loading} color="primary" onClick={add}>
            Add
          </LoadingButton>
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" justify="between" gap="2" className="w-full">
          {!hideAnalytics && (
            <Button type="link" block color="accent" href={`/tool/card/${card.scryfall_id}`} target="_blank">
              Analytics
            </Button>
          )}
          <Button block color="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default AddToCubeModal;
