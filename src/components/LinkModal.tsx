import React from 'react';

import { Modal, ModalHeader, ModalBody, ModalFooter } from 'components/base/Modal';

import Button from 'components/base/Button';

export interface LinkModalProps {
  link: string;
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
}

const LinkModal: React.FC<LinkModalProps> = ({ link, isOpen, setOpen }) => {
  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <ModalHeader setOpen={setOpen}>This link could be dangerous</ModalHeader>
      <ModalBody>
        <p>
          This link leads to: <code>{link}</code>
        </p>
        <p>Following unknown links can be dangerous, are you sure you wish to proceed?</p>
        <Button type="link" href={link} block color="danger" outline target="_blank" rel="noopener noreferrer">
          Yes, I know what I'm doing
        </Button>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={() => setOpen(false)}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default LinkModal;
