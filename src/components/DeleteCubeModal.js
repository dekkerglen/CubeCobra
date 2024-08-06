import React, { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';

import PropTypes from 'prop-types';

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
            Please type <code>{cubeName.trim()}</code> in order to confirm.
          </p>
          <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} />
        </ModalBody>
        <ModalFooter>
          <Button type="submit" color="unsafe" outline disabled={deleteText !== cubeName.trim()}>
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
