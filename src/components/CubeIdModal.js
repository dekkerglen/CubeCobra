import React from 'react';
import { Modal, ModalHeader, ModalBody, Button, ModalFooter, Input, Label } from 'reactstrap';
import PropTypes from 'prop-types';

const CubeIdModal = ({ toggle, isOpen, shortID, fullID }) => {
  return (
    <Modal isOpen={isOpen} toggle={toggle}>
      <ModalHeader>Cube ID</ModalHeader>
      <ModalBody>
        <h6>Short ID</h6>
        <Input id="short-id-input" style={{ fontFamily: 'Fira Mono' }} className="bg-white" value={shortID} readonly />
        <Label for="short-id-input">
          The short ID is a simple, easy to remember value that you can use to link to your cube. Cube owners can change
          the short ID to match their cube and make it more memorable.
        </Label>

        <h6 className="mt-3">Full ID</h6>
        <Input id="full-id-input" style={{ fontFamily: 'Fira Mono' }} className="bg-white" value={fullID} readonly />
        <Label for="full-id-input">
          The full ID is a unique identifier that will always stay the same for this cube, even if the short ID changes.
          If you want to guarantee that your link to a cube will always be valid, use the full ID.
        </Label>
        <br />
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={toggle}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

CubeIdModal.propTypes = {
  toggle: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired,
  shortID: PropTypes.string.isRequired,
  fullID: PropTypes.string.isRequired,
};

export default CubeIdModal;
