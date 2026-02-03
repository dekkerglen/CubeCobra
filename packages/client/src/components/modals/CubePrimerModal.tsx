import React, { useCallback, useContext, useState } from 'react';

import Cube from '@utils/datatypes/Cube';

import { CSRFContext } from '../../contexts/CSRFContext';
import Alert from '../base/Alert';
import Button from '../base/Button';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Text from '../base/Text';
import LoadingButton from '../LoadingButton';
import TagInput from '../TagInput';
import TextEntry from '../TextEntry';

interface CubePrimerModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cube: Cube;
}

interface AlertProps {
  color: string;
  message: string;
}

const CubePrimerModal: React.FC<CubePrimerModalProps> = ({ isOpen, setOpen, cube }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [description, setDescription] = useState(cube.description || '');
  const [tags, setTags] = useState<string[]>(cube.tags || []);
  const [alerts, setAlerts] = useState<AlertProps[]>([]);

  const saveChanges = useCallback(async () => {
    //Clear alerts when saving so easy to identify a new one appearing
    setAlerts([]);

    const response = await csrfFetch(`/cube/api/editprimer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cubeId: cube.id,
        description,
        tags,
      }),
    });

    const body = await response.json();
    if (response.ok) {
      //Reload page to ensure state is updated
      window.location.replace(body.redirect);
    } else {
      setAlerts([{ color: 'danger', message: body.error }]);
    }
  }, [csrfFetch, cube.id, description, tags]);

  return (
    <Modal lg isOpen={isOpen} setOpen={setOpen} scrollable>
      <ModalHeader setOpen={setOpen}>
        <Text semibold lg>
          Edit Primer
        </Text>
      </ModalHeader>
      <ModalBody scrollable>
        <Flexbox direction="col" gap="2">
          <Text semibold md>
            Description
          </Text>
          <TextEntry
            name="description"
            value={description}
            setValue={setDescription}
            maxLength={100000}
          />
          <TagInput
            label="Tags"
            tags={tags.map((tag) => ({ text: tag, id: tag }))}
            addTag={(tag) => {
              if (!tags.includes(tag.text)) {
                setTags([...tags, tag.text]);
              }
            }}
            deleteTag={(index) => {
              const newTags = [...tags];
              newTags.splice(index, 1);
              setTags(newTags);
            }}
          />
          {alerts.map(({ color, message }) => (
            <Alert key={message} color={color} className="mt-2">
              {message}
            </Alert>
          ))}
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" justify="between" className="w-full" gap="2">
          <LoadingButton color="primary" block onClick={saveChanges}>
            Save Changes
          </LoadingButton>
          <Button block color="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default CubePrimerModal;
