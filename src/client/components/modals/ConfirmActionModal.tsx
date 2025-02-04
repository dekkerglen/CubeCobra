import React from 'react';

import Button from '../base/Button';
import { Modal, ModalBody, ModalHeader } from '../base/Modal';
import Text from '../base/Text';

interface ConfirmActionModalProps {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  title: string;
  message: string;
  target?: string;
  onClick?: () => void;
  buttonText: string;
}

const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  setOpen,
  title,
  message,
  target,
  buttonText,
  onClick,
}) => {
  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <ModalHeader setOpen={setOpen}>{title}</ModalHeader>
      <ModalBody className="flex flex-col gap-2">
        <Text>{message}</Text>
        {target && (
          <Button type="link" color="danger" href={target}>
            {buttonText}
          </Button>
        )}
        {onClick && (
          <Button color="danger" onClick={onClick}>
            {buttonText}
          </Button>
        )}
      </ModalBody>
    </Modal>
  );
};

export default ConfirmActionModal;
