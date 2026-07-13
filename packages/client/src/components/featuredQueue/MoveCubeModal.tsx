import React from 'react';

import Button from '../base/Button';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Text from '../base/Text';
import CSRFForm from '../CSRFForm';

interface MoveCubeModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cubeId: string;
  currentPosition: number;
}

const MoveCubeModal: React.FC<MoveCubeModalProps> = ({ isOpen, setOpen, cubeId, currentPosition }) => {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [position, setPosition] = React.useState(`${currentPosition}`);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <CSRFForm
        method="POST"
        action="/admin/featuredcubes/move"
        ref={formRef}
        formData={{
          cubeId,
          position,
        }}
      >
        <ModalHeader setOpen={setOpen}>
          <Text semibold lg>
            Move Cube to Position
          </Text>
        </ModalHeader>
        <ModalBody>
          <Flexbox direction="col" gap="2">
            <Text sm>
              The cube will be placed between the cubes currently at the chosen position and the one before it.
            </Text>
            <Input label="New Position" type="number" value={position} onChange={(e) => setPosition(e.target.value)} />
          </Flexbox>
        </ModalBody>
        <ModalFooter>
          <Flexbox justify="between" className="w-full" gap="2">
            <Button color="primary" block onClick={() => formRef.current?.submit()}>
              Submit
            </Button>
            <Button color="secondary" block onClick={() => setOpen(false)}>
              Close
            </Button>
          </Flexbox>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

export default MoveCubeModal;
