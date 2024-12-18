import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import React from 'react';

interface DeleteCubeModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cubeID: string;
}

const DeleteCubeModal: React.FC<DeleteCubeModalProps> = ({ isOpen, setOpen, cubeID }) => {
  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <CSRFForm method="POST" action={`/cube/remove/${cubeID}`} formData={{}}>
        <ModalHeader setOpen={setOpen}>Delete Cube</ModalHeader>
        <ModalBody>
          <Text>Are you sure you want to delete this cube? This action cannot be undone.</Text>
        </ModalBody>
        <ModalFooter>
          <Flexbox direction="row" gap="2" className="w-full">
            <Button block type="submit" color="danger">
              Delete
            </Button>
            <Button block color="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </Flexbox>
        </ModalFooter>
      </CSRFForm>
    </Modal >
  );
};

export default DeleteCubeModal;
