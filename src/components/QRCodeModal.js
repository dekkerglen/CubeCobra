import React from 'react';
import PropTypes from 'prop-types';

import { Modal, ModalBody, ModalHeader } from 'reactstrap';

import QRCode from 'react-qr-code';

const QRCodeModal = ({ isOpen, toggle, link, title }) => (
  <Modal size="md" isOpen={isOpen} toggle={toggle}>
    <ModalHeader toggle={toggle}>{title}</ModalHeader>
    <ModalBody>
      <div className="centered">
        <QRCode value={link} />
      </div>
    </ModalBody>
  </Modal>
);

QRCodeModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  link: PropTypes.string.isRequired,
};

export default QRCodeModal;
