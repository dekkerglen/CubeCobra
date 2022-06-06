import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { Modal, ModalBody, ModalHeader, Input, Button, ModalFooter } from 'reactstrap';

import CSRFForm from 'components/CSRFForm';

const DeleteCubeModal = ({ isOpen, toggle, cubeId, cubeName }) => {
  const [deleteText, setDeleteText] = useState('');
  return (
    <Modal size="lg" isOpen={isOpen} toggle={toggle}>
      <ModalHeader toggle={toggle}>Confirm Cube Delete</ModalHeader>
      <CSRFForm method="POST" action={`/cube/remove/${cubeId}`}>
        <ModalBody>
          <p>Are you sure you wish to delete this cube? This action cannot be undone.</p>
          <p>
            Please type <code>{cubeName}</code> in order to confirm.
          </p>
          <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} />
        </ModalBody>
        <ModalFooter>
          <Button type="submit" color="unsafe" outline disabled={deleteText !== cubeName}>
            Delete
          </Button>
          <Button onClick={toggle}>Close</Button>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

DeleteCubeModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  cubeId: PropTypes.string.isRequired,
  cubeName: PropTypes.string.isRequired,
};

export default DeleteCubeModal;
