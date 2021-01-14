import PropTypes from 'prop-types';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from 'reactstrap';

import ButtonLink from 'components/ButtonLink';

const AddToCubeModal = ({ link, isOpen, toggle }) => {
  return (
    <Modal isOpen={isOpen} toggle={toggle} size="xs">
      <ModalHeader toggle={toggle}>This link could be dangerous</ModalHeader>
      <ModalBody>
        <p>
          This link leads to: <code>{link}</code>
        </p>
        <p>Following unknown links can be dangerous, are you sure you wish to proceed?</p>
        <ButtonLink href={link} block color="danger" outline target="_blank" rel="noopener noreferrer">
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

AddToCubeModal.propTypes = {
  link: PropTypes.string.isRequired,
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
};

export default AddToCubeModal;
