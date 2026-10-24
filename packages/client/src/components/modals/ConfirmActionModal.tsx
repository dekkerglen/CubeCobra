import React from 'react';

import Button from '../base/Button';
import { Modal, ModalBody, ModalHeader } from '../base/Modal';
import PostButton from '../base/PostButton';
import Text from '../base/Text';

interface ConfirmActionModalProps {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  title: string;
  message: string;
  // Route the confirm button POSTs to
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
          <PostButton action={target} color="danger" block>
            {buttonText}
          </PostButton>
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
