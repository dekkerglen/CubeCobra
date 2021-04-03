import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { Modal, ModalBody, ModalHeader, Input, Button, ModalFooter } from 'reactstrap';

import CSRFForm from 'components/CSRFForm';

const DeleteCubeModal = ({ isOpen, toggle, cubeid }) => {
  const [deleteText, setDeleteText] = useState('');
  return (
    <Modal size="lg" isOpen={isOpen} toggle={toggle}>
      <ModalHeader toggle={toggle}>Confirm Cube Delete</ModalHeader>
      <CSRFForm method="POST" action={`/cube/remove/${cubeid}`}>
        <ModalBody>
          <p>Are you sure you wish to delete this cube? This action cannot be undone.</p>
          <p>Please type 'Delete' in order to confirm</p>
          <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} />
        </ModalBody>
        <ModalFooter>
          <Button type="submit" color="danger" outline disabled={deleteText !== 'Delete'}>
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
  cubeid: PropTypes.string.isRequired,
};

export default DeleteCubeModal;
