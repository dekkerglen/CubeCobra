import React from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';

import PropTypes from 'prop-types';

const ConfirmDeleteModal = ({ isOpen, toggle, text, submitDelete }) => {
  return (
    <Modal isOpen={isOpen} toggle={toggle}>
      <ModalHeader toggle={toggle}>Confirm Delete</ModalHeader>
      <ModalBody>
        <p>{text}</p>
      </ModalBody>
      <ModalFooter>
        <Button
          color="unsafe"
          onClick={() => {
            submitDelete();
            toggle();
          }}
        >
          Delete
        </Button>{' '}
        <Button color="secondary" onClick={toggle}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

ConfirmDeleteModal.propTypes = {
  toggle: PropTypes.func.isRequired,
  submitDelete: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired,
  text: PropTypes.string.isRequired,
};

export default ConfirmDeleteModal;
