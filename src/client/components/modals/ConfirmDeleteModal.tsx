import React from 'react';

import Button from '../base/Button';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Text from '../base/Text';
import LoadingButton from '../LoadingButton';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  text: string;
  submitDelete: () => Promise<void>;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({ isOpen, setOpen, text, submitDelete }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <ModalHeader setOpen={setOpen}>
        <Text semibold lg>
          Confirm Delete
        </Text>
      </ModalHeader>
      <ModalBody>
        <p>{text}</p>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" className="w-full justify-end" gap="2">
          <LoadingButton
            block
            color="danger"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              submitDelete();
            }}
          >
            Delete
          </LoadingButton>
          <Button
            block
            color="secondary"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              setOpen(false);
            }}
          >
            Close
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default ConfirmDeleteModal;
