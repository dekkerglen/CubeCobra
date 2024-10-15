import React from 'react';
import { Modal, ModalHeader, ModalBody } from 'components/base/Modal';
import Button from 'components/base/Button';
import Text from 'components/base/Text';

interface ConfirmActionModalProps {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  title: string;
  message: string;
  target: string;
  buttonText: string;
}

const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  setOpen,
  title,
  message,
  target,
  buttonText,
}) => {
  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <ModalHeader setOpen={setOpen}>{title}</ModalHeader>
      <ModalBody className="flex flex-col gap-2">
        <Text>{message}</Text>
        <Button color="danger" href={target}>
          {buttonText}
        </Button>
      </ModalBody>
    </Modal>
  );
};

export default ConfirmActionModal;
