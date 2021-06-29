import React from 'react';
import PropTypes from 'prop-types';

import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';

import QRCode from 'react-qr-code';

const QRCodeModal = ({ isOpen, toggle, link, title }) => (
  <Modal size="md" isOpen={isOpen} toggle={toggle}>
    <ModalHeader toggle={toggle}>{title}</ModalHeader>
    <ModalBody>
      <div className="centered">
        <div className="p-3 qr-code-area">
          <QRCode value={link} />
        </div>
      </div>
    </ModalBody>
    <ModalFooter>
      <Button color="success">Download</Button>
      <Button color="secondary" onClick={toggle}>
        Close
      </Button>
    </ModalFooter>
  </Modal>
);

QRCodeModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  link: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
};

export default QRCodeModal;
