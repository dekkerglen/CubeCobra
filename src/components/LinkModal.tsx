import React from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';

import Button from 'components/base/Button';

export interface LinkModalProps {
  link: string;
  isOpen: boolean;
  toggle: () => void;
}

const LinkModal: React.FC<LinkModalProps> = ({ link, isOpen, toggle }) => {
  return (
    <Modal isOpen={isOpen} toggle={toggle} size="xs">
      <ModalHeader toggle={toggle}>This link could be dangerous</ModalHeader>
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
        <Button color="secondary" onClick={toggle}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default LinkModal;
