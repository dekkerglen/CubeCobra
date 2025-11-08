import React from 'react';

import Button from 'components/base/Button';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import type Cube from '@utils/datatypes/Cube';

interface DeleteCubeModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cube: Cube;
}

const DeleteCubeModal: React.FC<DeleteCubeModalProps> = ({ isOpen, setOpen, cube }) => {
  const [name, setName] = React.useState('');
  const formRef = React.useRef<HTMLFormElement>(null);
  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <ModalHeader setOpen={setOpen}>Delete Cube</ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="2" className="w-full">
          <CSRFForm method="POST" action={`/cube/remove/${cube.id}`} formData={{}} ref={formRef}>
            <Text>Are you sure you want to delete this cube? To delete, please type the name of the cube.</Text>
            <Input value={name} onChange={(e) => setName(e.target.value)} valid={name === cube.name} />
          </CSRFForm>
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" gap="2" className="w-full">
          <Button block color="danger" disabled={name !== cube.name} onClick={() => formRef.current?.submit()}>
            Delete
          </Button>
          <Button block color="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default DeleteCubeModal;
