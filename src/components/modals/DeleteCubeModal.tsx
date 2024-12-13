import React from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Button from 'components/base/Button';
import Text from 'components/base/Text';

interface DeleteCubeModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cubeID: string;
}

const DeleteCubeModal: React.FC<DeleteCubeModalProps> = ({ isOpen, setOpen, cubeID }) => {
  return (
    <Modal isOpen={isOpen} setOpen={setOpen}>
      <ModalHeader setOpen={setOpen}>Delete Cube</ModalHeader>
      <ModalBody>
        <Text>Are you sure you want to delete this cube? This action cannot be undone.</Text>
      </ModalBody>
      <ModalFooter>
        <Button color="danger" href={`/cube/delete/${cubeID}`}>
          Delete
        </Button>
        <Button color="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default DeleteCubeModal;
