import React from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Button from 'components/base/Button';
import Text from 'components/base/Text';
import { Flexbox } from 'components/base/Layout';

interface DeleteCubeModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cubeID: string;
}

const DeleteCubeModal: React.FC<DeleteCubeModalProps> = ({ isOpen, setOpen, cubeID }) => {
  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <ModalHeader setOpen={setOpen}>Delete Cube</ModalHeader>
      <ModalBody>
        <Text>Are you sure you want to delete this cube? This action cannot be undone.</Text>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" gap="2" className="w-full">
          <Button block type="link" color="danger" href={`/cube/delete/${cubeID}`}>
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
