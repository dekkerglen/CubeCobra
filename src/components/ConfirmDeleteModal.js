import PropTypes from 'prop-types';

import React from 'react';

import { Modal, ModalBody, ModalFooter, ModalHeader, Button } from 'reactstrap';

const ConfirmDeleteModal = ({ isOpen, toggle, text, submitDelete }) => {
  return (
    <Modal isOpen={isOpen} toggle={toggle}>
      <ModalHeader toggle={toggle}>Confirm Delete</ModalHeader>
      <ModalBody>
        <p>{text}</p>
      </ModalBody>
      <ModalFooter>
        <Button
          color="danger"
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
