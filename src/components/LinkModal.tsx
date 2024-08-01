import { FC } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from 'reactstrap';

import ButtonLink from 'components/ButtonLink';

export interface LinkModalProps {
  link: string;
  isOpen: boolean;
  toggle: () => void;
}

const LinkModal: FC<LinkModalProps> = ({ link, isOpen, toggle }) => {
  return (
    <Modal isOpen={isOpen} toggle={toggle} size="xs">
      <ModalHeader toggle={toggle}>This link could be dangerous</ModalHeader>
      <ModalBody>
        <p>
          This link leads to: <code>{link}</code>
        </p>
        <p>Following unknown links can be dangerous, are you sure you wish to proceed?</p>
        <ButtonLink href={link} block color="unsafe" outline target="_blank" rel="noopener noreferrer">
          Yes, I know what I'm doing
        </ButtonLink>
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
