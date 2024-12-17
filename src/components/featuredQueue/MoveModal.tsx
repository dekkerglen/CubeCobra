import React from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Text from 'components/base/Text';
import Cube from 'datatypes/Cube';
import CSRFForm from 'components/CSRFForm';
import { Flexbox } from 'components/base/Layout';
import Button from 'components/base/Button';
import Input from 'components/base/Input';

interface MoveModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cube: Cube;
  index: number;
}

const MoveModal: React.FC<MoveModalProps> = ({ isOpen, setOpen, cube, index }) => {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [to, setTo] = React.useState((index + 1).toString());

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <CSRFForm
        method="POST"
        action="/admin/featuredcubes/move"
        ref={formRef}
        formData={{
          'move-cube-from': (index + 1).toString(),
          'move-cube-to': to,
          cubeId: cube.id,
        }}
      >
        <ModalHeader setOpen={setOpen}>
          <Text semibold lg>
            Move Cube
          </Text>
        </ModalHeader>
        <ModalBody>
          <Flexbox direction="col" gap="2">
            <Text semibold>Cube Name: {cube?.name}</Text>
            <Input
              label="New position in queue"
              type="number"
              name="to"
              placeholder={(index + 1).toString()}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
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

export default MoveModal;
